import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def handler(event: dict, context) -> dict:
    """Таблица лидеров — топ игроков по монетам"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, avatar, coins, wins, losses FROM players ORDER BY coins DESC LIMIT 20"
    )
    rows = cur.fetchall()
    conn.close()

    leaders = []
    for r in rows:
        leaders.append({
            'id': str(r[0]),
            'name': r[1],
            'avatar': r[2],
            'coins': r[3],
            'wins': r[4],
            'losses': r[5],
        })

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'leaders': leaders})
    }
