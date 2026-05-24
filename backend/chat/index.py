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

def handler(event: dict, context) -> dict:
    """Чат: отправка и получение сообщений"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        player_id = body.get('player_id')
        player_name = (body.get('player_name') or '').strip()[:32]
        player_avatar = (body.get('player_avatar') or '🦊')[:8]
        is_vip = bool(body.get('is_vip', False))
        text = (body.get('text') or '').strip()[:200]

        if not text or not player_name:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'text and player_name required'})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_messages (player_id, player_name, player_avatar, is_vip, text) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
            (player_id, player_name, player_avatar, is_vip, text)
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'id': str(row[0]),
                'player_id': str(player_id) if player_id else None,
                'player_name': player_name,
                'player_avatar': player_avatar,
                'is_vip': is_vip,
                'text': text,
                'created_at': row[1].isoformat(),
            })
        }

    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        limit = min(int(params.get('limit', 50)), 100)
        since = params.get('since')

        conn = get_conn()
        cur = conn.cursor()

        if since:
            cur.execute(
                "SELECT id, player_id, player_name, player_avatar, is_vip, text, created_at FROM chat_messages WHERE created_at > %s ORDER BY created_at ASC LIMIT %s",
                (since, limit)
            )
        else:
            cur.execute(
                "SELECT id, player_id, player_name, player_avatar, is_vip, text, created_at FROM chat_messages ORDER BY created_at DESC LIMIT %s",
                (limit,)
            )

        rows = cur.fetchall()
        conn.close()

        messages = []
        for r in reversed(rows) if not since else rows:
            messages.append({
                'id': str(r[0]),
                'player_id': str(r[1]) if r[1] else None,
                'player_name': r[2],
                'player_avatar': r[3],
                'is_vip': r[4],
                'text': r[5],
                'created_at': r[6].isoformat(),
            })

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'messages': messages})
        }

    return {'statusCode': 405, 'headers': CORS, 'body': ''}
