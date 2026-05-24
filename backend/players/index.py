import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def handler(event: dict, context) -> dict:
    """Регистрация и получение профиля игрока"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        name = (body.get('name') or '').strip()[:32]
        avatar = (body.get('avatar') or '🦊')[:8]

        if not name or len(name) < 2:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Имя слишком короткое'})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO players (name, avatar, coins) VALUES (%s, %s, 100) RETURNING id, name, avatar, coins, wins, losses",
            (name, avatar)
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'id': str(row[0]),
                'name': row[1],
                'avatar': row[2],
                'coins': row[3],
                'wins': row[4],
                'losses': row[5],
            })
        }

    if method == 'PUT':
        body = json.loads(event.get('body') or '{}')
        player_id = body.get('player_id')
        delta = int(body.get('coins_delta', 0))
        is_win = body.get('is_win')

        conn = get_conn()
        cur = conn.cursor()

        if is_win is True:
            cur.execute(
                "UPDATE players SET coins = GREATEST(0, coins + %s), wins = wins + 1, last_seen = NOW() WHERE id = %s RETURNING coins, wins, losses",
                (delta, player_id)
            )
        elif is_win is False:
            cur.execute(
                "UPDATE players SET coins = GREATEST(0, coins + %s), losses = losses + 1, last_seen = NOW() WHERE id = %s RETURNING coins, wins, losses",
                (delta, player_id)
            )
        else:
            cur.execute(
                "UPDATE players SET coins = GREATEST(0, coins + %s), last_seen = NOW() WHERE id = %s RETURNING coins, wins, losses",
                (delta, player_id)
            )

        row = cur.fetchone()
        conn.commit()
        conn.close()

        if not row:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Игрок не найден'})}

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'coins': row[0], 'wins': row[1], 'losses': row[2]})
        }

    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        player_id = params.get('id')
        if not player_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id required'})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE players SET last_seen = NOW() WHERE id = %s RETURNING id, name, avatar, coins, wins, losses",
            (player_id,)
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()

        if not row:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'not found'})}

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'id': str(row[0]), 'name': row[1], 'avatar': row[2], 'coins': row[3], 'wins': row[4], 'losses': row[5]})
        }

    return {'statusCode': 405, 'headers': CORS, 'body': ''}
