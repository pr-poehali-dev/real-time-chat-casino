import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

TOTAL_SEATS = 5
VIP_SEAT = 0

def get_or_create_session(cur):
    cur.execute("SELECT id, game_id, status FROM game_sessions WHERE status = 'waiting' ORDER BY created_at DESC LIMIT 1")
    row = cur.fetchone()
    if row:
        return str(row[0]), row[1], row[2]
    cur.execute("INSERT INTO game_sessions (game_id, status) VALUES ('blackjack', 'waiting') RETURNING id, game_id, status")
    row = cur.fetchone()
    return str(row[0]), row[1], row[2]

def get_seats(cur, session_id):
    cur.execute(
        "SELECT seat_index, player_id, is_vip, p.name, p.avatar, p.coins FROM table_seats ts LEFT JOIN players p ON ts.player_id = p.id WHERE ts.session_id = %s ORDER BY seat_index",
        (session_id,)
    )
    rows = cur.fetchall()
    seats = {i: {'index': i, 'is_vip': i == VIP_SEAT, 'player': None} for i in range(TOTAL_SEATS)}
    for r in rows:
        seats[r[0]] = {
            'index': r[0],
            'is_vip': r[2],
            'player': {
                'id': str(r[1]) if r[1] else None,
                'name': r[3],
                'avatar': r[4],
                'coins': r[5],
                'is_vip': r[2],
                'seat_index': r[0],
            } if r[1] else None
        }
    return list(seats.values())

def handler(event: dict, context) -> dict:
    """Стол: получение мест, занятие/освобождение места, смена игры"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        session_id, game_id, status = get_or_create_session(cur)
        seats = get_seats(cur, session_id)
        conn.commit()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'session_id': session_id, 'game_id': game_id, 'status': status, 'seats': seats})
        }

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        action = body.get('action')

        if action == 'take_seat':
            player_id = body.get('player_id')
            seat_index = int(body.get('seat_index', 0))
            session_id = body.get('session_id')

            if not session_id:
                session_id, _, _ = get_or_create_session(cur)

            cur.execute("SELECT player_id FROM table_seats WHERE session_id = %s AND seat_index = %s", (session_id, seat_index))
            existing = cur.fetchone()
            if existing and existing[0]:
                conn.close()
                return {'statusCode': 409, 'headers': CORS, 'body': json.dumps({'error': 'Место занято'})}

            cur.execute("SELECT id FROM table_seats WHERE session_id = %s AND player_id = %s", (session_id, player_id))
            old = cur.fetchone()
            if old:
                cur.execute("UPDATE table_seats SET player_id = NULL, is_vip = FALSE WHERE session_id = %s AND player_id = %s", (session_id, player_id))

            cur.execute("SELECT id FROM table_seats WHERE session_id = %s AND seat_index = %s", (session_id, seat_index))
            seat_row = cur.fetchone()
            is_vip = seat_index == VIP_SEAT
            if seat_row:
                cur.execute("UPDATE table_seats SET player_id = %s, is_vip = %s, joined_at = NOW() WHERE session_id = %s AND seat_index = %s", (player_id, is_vip, session_id, seat_index))
            else:
                cur.execute("INSERT INTO table_seats (session_id, seat_index, player_id, is_vip) VALUES (%s, %s, %s, %s)", (session_id, seat_index, player_id, is_vip))

            seats = get_seats(cur, session_id)
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'seats': seats, 'is_vip': is_vip})}

        if action == 'leave_seat':
            player_id = body.get('player_id')
            session_id = body.get('session_id')
            cur.execute("UPDATE table_seats SET player_id = NULL, is_vip = FALSE WHERE session_id = %s AND player_id = %s", (session_id, player_id))
            seats = get_seats(cur, session_id)
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'seats': seats})}

        if action == 'change_game':
            session_id = body.get('session_id')
            game_id = body.get('game_id')
            player_id = body.get('player_id')
            cur.execute("SELECT player_id FROM table_seats WHERE session_id = %s AND seat_index = %s", (session_id, VIP_SEAT))
            vip_row = cur.fetchone()
            if not vip_row or str(vip_row[0]) != str(player_id):
                conn.close()
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только VIP может менять игру'})}
            cur.execute("UPDATE game_sessions SET game_id = %s WHERE id = %s", (game_id, session_id))
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'game_id': game_id})}

    conn.close()
    return {'statusCode': 405, 'headers': CORS, 'body': ''}
