import json, os, random, psycopg2
from datetime import datetime

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def ok(data): return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data, default=str)}
def err(msg, code=400): return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg})}

# ── Deck helpers ──────────────────────────────────────────────
SUITS = ['♠','♥','♦','♣']
VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
UNO_COLORS = ['red','blue','green','yellow']
UNO_NUMS = ['0','1','2','3','4','5','6','7','8','9']
UNO_SPECIALS = ['+2','skip','reverse']
DURAK_VALUES = ['6','7','8','9','10','J','Q','K','A']

def make_deck(game):
    if game == 'durak':
        d = [{'s': s, 'v': v} for s in SUITS for v in DURAK_VALUES]
    elif game == 'uno':
        d = []
        for c in UNO_COLORS:
            for n in UNO_NUMS: d.append({'c': c, 'v': n})
            for sp in UNO_SPECIALS:
                d.append({'c': c, 'v': sp})
                d.append({'c': c, 'v': sp})
    else:  # poker / blackjack
        d = [{'s': s, 'v': v} for s in SUITS for v in VALUES]
    random.shuffle(d)
    return d

def bj_value(hand):
    score, aces = 0, 0
    for c in hand:
        v = c['v']
        if v in ('J','Q','K'): score += 10
        elif v == 'A': score += 11; aces += 1
        else: score += int(v)
    while score > 21 and aces > 0:
        score -= 10; aces -= 1
    return score

def poker_rank(cards):
    """Returns numeric rank 0-8"""
    if len(cards) < 2: return 0
    nums = sorted([VALUES.index(c['v']) for c in cards], reverse=True)
    suits = [c['s'] for c in cards]
    from collections import Counter
    cnt = sorted(Counter(nums).values(), reverse=True)
    is_flush = len(set(suits)) == 1 and len(cards) >= 5
    is_straight = len(cards) >= 5 and (max(nums) - min(nums) == 4 and len(set(nums)) == 5)
    if is_flush and is_straight and max(nums) == 12: return 8
    if is_flush and is_straight: return 7
    if cnt[0] == 4: return 6
    if cnt[0] == 3 and len(cnt) > 1 and cnt[1] == 2: return 5
    if is_flush: return 4
    if is_straight: return 3
    if cnt[0] == 3: return 2
    if cnt[0] == 2 and len(cnt) > 1 and cnt[1] == 2: return 1
    if cnt[0] == 2: return 0
    return 0

RANK_NAMES = ['Пара','Две пары','Тройка','Стрит','Флэш','Фулл хаус','Каре','Стрит-флэш','Роял-флэш','Старшая карта']

def can_beat_durak(attacker, defender, trump):
    if defender['s'] == trump and attacker['s'] != trump: return True
    if defender['s'] == attacker['s']:
        return DURAK_VALUES.index(defender['v']) > DURAK_VALUES.index(attacker['v'])
    return False

def uno_can_play(card, top):
    return card['c'] == top['c'] or card['v'] == top['v']

# ── Session helpers ───────────────────────────────────────────
def load_session(cur, session_id):
    cur.execute("SELECT id, game_id, status, round_state, current_turn, pot FROM game_sessions WHERE id = %s", (session_id,))
    row = cur.fetchone()
    if not row: return None
    return {'id': str(row[0]), 'game_id': row[1], 'status': row[2],
            'state': row[3] or {}, 'current_turn': str(row[4]) if row[4] else None, 'pot': row[5] or 0}

def save_session(cur, session_id, status=None, state=None, current_turn=None, pot=None):
    sets, vals = [], []
    if status is not None: sets.append("status = %s"); vals.append(status)
    if state is not None: sets.append("round_state = %s"); vals.append(json.dumps(state))
    if current_turn is not None: sets.append("current_turn = %s"); vals.append(current_turn)
    if pot is not None: sets.append("pot = %s"); vals.append(pot)
    sets.append("updated_at = NOW()")
    vals.append(session_id)
    cur.execute(f"UPDATE game_sessions SET {', '.join(sets)} WHERE id = %s", vals)

def get_seated_players(cur, session_id):
    cur.execute("""
        SELECT ts.seat_index, ts.player_id, ts.is_vip, p.name, p.avatar, p.coins
        FROM table_seats ts JOIN players p ON ts.player_id = p.id
        WHERE ts.session_id = %s AND ts.player_id IS NOT NULL
        ORDER BY ts.seat_index
    """, (session_id,))
    return [{'seat': r[0], 'id': str(r[1]), 'is_vip': r[2], 'name': r[3], 'avatar': r[4], 'coins': r[5]} for r in cur.fetchall()]

def update_coins(cur, player_id, delta, is_win=None):
    if is_win is True:
        cur.execute("UPDATE players SET coins = GREATEST(0, coins + %s), wins = wins + 1 WHERE id = %s RETURNING coins", (delta, player_id))
    elif is_win is False:
        cur.execute("UPDATE players SET coins = GREATEST(0, coins + %s), losses = losses + 1 WHERE id = %s RETURNING coins", (delta, player_id))
    else:
        cur.execute("UPDATE players SET coins = GREATEST(0, coins + %s) WHERE id = %s RETURNING coins", (delta, player_id))
    row = cur.fetchone()
    return row[0] if row else 0

def log_action(cur, session_id, player_id, action_type, data):
    cur.execute("INSERT INTO game_actions (session_id, player_id, action_type, action_data) VALUES (%s, %s, %s, %s)",
                (session_id, player_id, action_type, json.dumps(data)))

# ═══════════════════════════════════════════════════════════════
def handler(event: dict, context) -> dict:
    """Игровой движок: старт, ходы, результаты для всех игр"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    # GET — получить текущее состояние игры
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        session_id = params.get('session_id')
        if not session_id: return err('session_id required')
        conn = get_conn()
        cur = conn.cursor()
        sess = load_session(cur, session_id)
        conn.close()
        if not sess: return err('session not found', 404)
        return ok(sess)

    if method != 'POST': return err('method not allowed', 405)

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')
    session_id = body.get('session_id')
    player_id = body.get('player_id')

    conn = get_conn()
    cur = conn.cursor()

    sess = load_session(cur, session_id)
    if not sess:
        conn.close()
        return err('session not found', 404)

    game = sess['game_id']
    state = sess['state']
    players = get_seated_players(cur, session_id)
    player_ids = [p['id'] for p in players]

    # ── START GAME ────────────────────────────────────────────
    if action == 'start':
        bet = int(body.get('bet', 10))
        if len(players) < 1:
            conn.close(); return err('Нужен хотя бы 1 игрок за столом')

        deck = make_deck(game)

        if game == 'blackjack':
            hands = {}
            for p in players:
                hands[p['id']] = [deck.pop(), deck.pop()]
            dealer_hand = [deck.pop(), deck.pop()]
            new_state = {
                'phase': 'play', 'bet': bet,
                'hands': hands, 'dealer': dealer_hand,
                'stood': [], 'busted': [], 'deck': deck,
                'results': {}
            }
            turn = player_ids[0]
            pot = bet * len(players)

        elif game == 'poker':
            hands = {p['id']: [deck.pop(), deck.pop()] for p in players}
            community = [deck.pop() for _ in range(5)]
            new_state = {
                'phase': 'preflop', 'bet': bet,
                'hands': hands, 'community': community,
                'community_revealed': 0,
                'folded': [], 'called': [], 'raised': [],
                'deck': deck, 'results': {},
                'call_amount': bet
            }
            turn = player_ids[0]
            pot = bet * len(players)

        elif game == 'durak':
            trump_card = deck[-1]
            trump = trump_card['s']
            hands = {p['id']: [deck.pop(0) for _ in range(6)] for p in players}
            new_state = {
                'phase': 'attack', 'bet': bet,
                'hands': hands, 'trump': trump, 'trump_card': trump_card,
                'deck': deck, 'table_attack': None, 'table_defend': None,
                'attacker': player_ids[0],
                'defender': player_ids[1] if len(player_ids) > 1 else player_ids[0],
                'discard': [], 'results': {}
            }
            turn = player_ids[0]
            pot = bet * len(players)

        elif game == 'uno':
            hands = {p['id']: [deck.pop() for _ in range(7)] for p in players}
            top = deck.pop()
            while top['v'] in UNO_SPECIALS:
                deck.insert(0, top)
                top = deck.pop()
            new_state = {
                'phase': 'play', 'bet': bet,
                'hands': hands, 'deck': deck, 'top': top,
                'direction': 1, 'skipped': [],
                'results': {}, 'uno_called': {}
            }
            turn = player_ids[0]
            pot = bet * len(players)
        else:
            conn.close(); return err('Unknown game')

        # deduct bets
        for p in players:
            update_coins(cur, p['id'], -bet)
        log_action(cur, session_id, player_id, 'start', {'game': game, 'bet': bet, 'players': len(players)})
        save_session(cur, session_id, status='playing', state=new_state, current_turn=turn, pot=pot)
        conn.commit(); conn.close()
        return ok({'status': 'playing', 'state': new_state, 'current_turn': turn, 'pot': pot})

    # ── GAME ACTIONS ──────────────────────────────────────────
    if action in ('hit', 'stand', 'call', 'raise', 'fold', 'play_card', 'draw_card', 'attack', 'defend', 'take_cards', 'end_round'):
        if sess['status'] != 'playing':
            conn.close(); return err('Игра не идёт')

        current_turn = sess['current_turn']
        pot = sess['pot']

        # ── BLACKJACK ──
        if game == 'blackjack':
            hands = state['hands']
            dealer = state['dealer']
            stood = state.get('stood', [])
            busted = state.get('busted', [])
            deck = state['deck']
            bet = state['bet']
            results = state.get('results', {})

            if action == 'hit':
                if player_id != current_turn:
                    conn.close(); return err('Не ваш ход')
                card = deck.pop(0)
                hands[player_id].append(card)
                score = bj_value(hands[player_id])
                if score > 21:
                    busted.append(player_id)
                    update_coins(cur, player_id, 0, is_win=False)
                    results[player_id] = {'result': 'bust', 'score': score, 'delta': -bet}
                    log_action(cur, session_id, player_id, 'bust', {'score': score})
                    next_idx = (player_ids.index(player_id) + 1) % len(player_ids)
                    next_turn = player_ids[next_idx] if player_ids[next_idx] not in busted + stood else None
                else:
                    next_turn = player_id
                state.update({'hands': hands, 'busted': busted, 'deck': deck, 'results': results})

            elif action == 'stand':
                if player_id != current_turn:
                    conn.close(); return err('Не ваш ход')
                stood.append(player_id)
                next_players = [p for p in player_ids if p not in stood and p not in busted]
                next_turn = next_players[0] if next_players else None
                state.update({'stood': stood})

            # Dealer plays and resolve when all done
            remaining = [p for p in player_ids if p not in stood and p not in busted]
            if not remaining or next_turn is None:
                while bj_value(dealer) < 17:
                    dealer.append(deck.pop(0))
                dealer_score = bj_value(dealer)
                state['dealer'] = dealer
                state['phase'] = 'done'
                for pid in player_ids:
                    if pid in busted: continue
                    pscore = bj_value(hands[pid])
                    if dealer_score > 21 or pscore > dealer_score:
                        win = bet * 2
                        new_coins = update_coins(cur, pid, win, is_win=True)
                        results[pid] = {'result': 'win', 'score': pscore, 'delta': win, 'coins': new_coins}
                    elif pscore == dealer_score:
                        new_coins = update_coins(cur, pid, bet)
                        results[pid] = {'result': 'push', 'score': pscore, 'delta': 0, 'coins': new_coins}
                    else:
                        new_coins = update_coins(cur, pid, 0, is_win=False)
                        results[pid] = {'result': 'lose', 'score': pscore, 'delta': -bet, 'coins': new_coins}
                state['results'] = results
                save_session(cur, session_id, status='finished', state=state, current_turn=None, pot=0)
                conn.commit(); conn.close()
                return ok({'status': 'finished', 'state': state, 'current_turn': None, 'pot': 0})

            save_session(cur, session_id, state=state, current_turn=next_turn)
            conn.commit(); conn.close()
            return ok({'status': 'playing', 'state': state, 'current_turn': next_turn, 'pot': pot})

        # ── POKER ──
        elif game == 'poker':
            hands = state['hands']
            community = state['community']
            revealed = state.get('community_revealed', 0)
            folded = state.get('folded', [])
            called = state.get('called', [])
            raised = state.get('raised', [])
            call_amount = state.get('call_amount', state['bet'])
            bet_base = state['bet']

            if action == 'fold':
                folded.append(player_id)
                update_coins(cur, player_id, 0, is_win=False)
                log_action(cur, session_id, player_id, 'fold', {})
            elif action == 'call':
                called.append(player_id)
                pot += call_amount
                update_coins(cur, player_id, -call_amount)
                log_action(cur, session_id, player_id, 'call', {'amount': call_amount})
            elif action == 'raise':
                raise_amount = call_amount + 20
                called.append(player_id)
                raised.append(player_id)
                pot += raise_amount
                call_amount = raise_amount
                update_coins(cur, player_id, -raise_amount)
                log_action(cur, session_id, player_id, 'raise', {'amount': raise_amount})

            active = [p for p in player_ids if p not in folded]
            all_acted = all(p in called or p in folded for p in player_ids)

            if len(active) <= 1 or all_acted:
                # advance street
                phase_map = {'preflop': ('flop', 3), 'flop': ('turn', 4), 'turn': ('river', 5), 'river': ('done', 5)}
                next_phase, next_revealed = phase_map.get(state['phase'], ('done', 5))
                state['phase'] = next_phase
                state['community_revealed'] = next_revealed
                state['called'] = []
                state['raised'] = []
                called, raised = [], []

                if next_phase == 'done' or len(active) <= 1:
                    state['phase'] = 'done'
                    results = {}
                    winner = None
                    best_rank = -1
                    for pid in active:
                        all_cards = hands[pid] + community[:next_revealed]
                        rank = poker_rank(all_cards)
                        results[pid] = {'rank': rank, 'rank_name': RANK_NAMES[rank] if rank < len(RANK_NAMES) else 'Старшая'}
                        if rank > best_rank:
                            best_rank = rank; winner = pid
                    win_amount = pot
                    for pid in player_ids:
                        if pid == winner:
                            new_c = update_coins(cur, pid, win_amount, is_win=True)
                            results[pid]['delta'] = win_amount; results[pid]['coins'] = new_c
                        elif pid not in folded:
                            new_c = update_coins(cur, pid, 0, is_win=False)
                            results[pid]['delta'] = -bet_base; results[pid]['coins'] = new_c
                    state['results'] = results; state['winner'] = winner
                    save_session(cur, session_id, status='finished', state=state, current_turn=None, pot=0)
                    conn.commit(); conn.close()
                    return ok({'status': 'finished', 'state': state, 'current_turn': None, 'pot': 0})

            next_active = [p for p in player_ids if p not in folded]
            cur_idx = next_active.index(player_id) if player_id in next_active else 0
            next_turn = next_active[(cur_idx + 1) % len(next_active)]
            state.update({'folded': folded, 'called': called, 'raised': raised, 'call_amount': call_amount})
            save_session(cur, session_id, state=state, current_turn=next_turn, pot=pot)
            conn.commit(); conn.close()
            return ok({'status': 'playing', 'state': state, 'current_turn': next_turn, 'pot': pot})

        # ── DURAK ──
        elif game == 'durak':
            hands = state['hands']
            trump = state['trump']
            attacker_id = state['attacker']
            defender_id = state['defender']
            deck = state['deck']
            table_attack = state.get('table_attack')
            table_defend = state.get('table_defend')
            discard = state.get('discard', [])
            bet_val = state['bet']

            if action == 'attack':
                card_data = body.get('card')
                if player_id != attacker_id:
                    conn.close(); return err('Не ваш ход атаковать')
                if str(card_data) not in [str(c) for c in hands.get(player_id, [])]:
                    # find by value
                    card = next((c for c in hands.get(player_id, []) if c.get('v') == card_data.get('v') and c.get('s') == card_data.get('s')), None)
                else:
                    card = card_data
                if not card:
                    card = next((c for c in hands.get(player_id, []) if c.get('v') == (card_data or {}).get('v')), None)
                if card and card in hands.get(player_id, []):
                    hands[player_id].remove(card)
                state['table_attack'] = card
                state['table_defend'] = None
                state['hands'] = hands
                save_session(cur, session_id, state=state, current_turn=defender_id)
                conn.commit(); conn.close()
                return ok({'status': 'playing', 'state': state, 'current_turn': defender_id, 'pot': pot})

            elif action == 'defend':
                card_data = body.get('card')
                if player_id != defender_id:
                    conn.close(); return err('Не ваш ход отбивать')
                if not table_attack:
                    conn.close(); return err('Нет атакующей карты')
                card = next((c for c in hands.get(player_id, []) if c.get('v') == (card_data or {}).get('v') and c.get('s') == (card_data or {}).get('s')), None)
                if not card or not can_beat_durak(table_attack, card, trump):
                    conn.close(); return err('Нельзя отбить этой картой')
                hands[player_id].remove(card)
                discard.extend([table_attack, card])
                state.update({'table_attack': None, 'table_defend': None, 'discard': discard, 'hands': hands})
                # Refill from deck
                for pid in player_ids:
                    while len(hands.get(pid, [])) < 6 and deck:
                        hands[pid].append(deck.pop(0))
                # Check win
                for pid in player_ids:
                    if len(hands.get(pid, [])) == 0:
                        win = pot
                        update_coins(cur, pid, win, is_win=True)
                        for op in player_ids:
                            if op != pid:
                                update_coins(cur, op, 0, is_win=False)
                        state['results'] = {pid: {'result': 'win', 'delta': win}, **{op: {'result': 'lose', 'delta': -bet_val} for op in player_ids if op != pid}}
                        state['phase'] = 'done'
                        save_session(cur, session_id, status='finished', state=state, current_turn=None, pot=0)
                        conn.commit(); conn.close()
                        return ok({'status': 'finished', 'state': state, 'current_turn': None, 'pot': 0})
                save_session(cur, session_id, state=state, current_turn=attacker_id)
                conn.commit(); conn.close()
                return ok({'status': 'playing', 'state': state, 'current_turn': attacker_id, 'pot': pot})

            elif action == 'take_cards':
                if player_id != defender_id:
                    conn.close(); return err('Не ваш ход')
                taken = []
                if table_attack: taken.append(table_attack)
                if table_defend: taken.append(table_defend)
                hands[player_id] = hands.get(player_id, []) + taken
                state.update({'table_attack': None, 'table_defend': None, 'hands': hands})
                # attacker stays attacker
                save_session(cur, session_id, state=state, current_turn=attacker_id)
                conn.commit(); conn.close()
                return ok({'status': 'playing', 'state': state, 'current_turn': attacker_id, 'pot': pot})

            elif action == 'end_round':
                # force finish
                win_pid = min(player_ids, key=lambda p: len(hands.get(p, [])))
                win_amount = pot
                update_coins(cur, win_pid, win_amount, is_win=True)
                for op in player_ids:
                    if op != win_pid:
                        update_coins(cur, op, 0, is_win=False)
                state['results'] = {win_pid: {'result': 'win', 'delta': win_amount}, **{op: {'result': 'lose', 'delta': -bet_val} for op in player_ids if op != win_pid}}
                state['phase'] = 'done'
                save_session(cur, session_id, status='finished', state=state, current_turn=None, pot=0)
                conn.commit(); conn.close()
                return ok({'status': 'finished', 'state': state, 'current_turn': None, 'pot': 0})

        # ── UNO ──
        elif game == 'uno':
            hands = state['hands']
            deck = state['deck']
            top = state['top']
            direction = state.get('direction', 1)
            skipped = state.get('skipped', [])
            bet_val = state['bet']
            results = state.get('results', {})

            cur_idx = player_ids.index(player_id) if player_id in player_ids else 0

            if action == 'play_card':
                if player_id != current_turn:
                    conn.close(); return err('Не ваш ход')
                card_data = body.get('card')
                card = next((c for c in hands.get(player_id, []) if c.get('v') == card_data.get('v') and c.get('c') == card_data.get('c')), None)
                if not card:
                    conn.close(); return err('Карта не найдена')
                if not uno_can_play(card, top):
                    conn.close(); return err('Эту карту нельзя сыграть')
                hands[player_id].remove(card)
                state['top'] = card
                top = card

                # Special effects
                next_direction = direction
                extra_skip = False
                extra_draw = 0
                if card['v'] == 'reverse':
                    next_direction = -direction
                elif card['v'] == 'skip':
                    extra_skip = True
                elif card['v'] == '+2':
                    extra_draw = 2

                # Check win
                if len(hands[player_id]) == 0:
                    win_amount = pot
                    update_coins(cur, player_id, win_amount, is_win=True)
                    for op in player_ids:
                        if op != player_id:
                            update_coins(cur, op, 0, is_win=False)
                    state['results'] = {player_id: {'result': 'win', 'delta': win_amount}, **{op: {'result': 'lose', 'delta': -bet_val} for op in player_ids if op != player_id}}
                    state['phase'] = 'done'; state['hands'] = hands
                    save_session(cur, session_id, status='finished', state=state, current_turn=None, pot=0)
                    conn.commit(); conn.close()
                    return ok({'status': 'finished', 'state': state, 'current_turn': None, 'pot': 0})

                # Next player
                step = direction
                next_idx = (cur_idx + step) % len(player_ids)
                next_pid = player_ids[next_idx]
                if extra_skip:
                    next_idx = (next_idx + step) % len(player_ids)
                    next_pid = player_ids[next_idx]
                if extra_draw > 0:
                    draw_cards = [deck.pop(0) for _ in range(min(extra_draw, len(deck)))]
                    hands[next_pid] = hands.get(next_pid, []) + draw_cards
                state.update({'hands': hands, 'deck': deck, 'direction': next_direction})
                save_session(cur, session_id, state=state, current_turn=next_pid)
                conn.commit(); conn.close()
                return ok({'status': 'playing', 'state': state, 'current_turn': next_pid, 'pot': pot})

            elif action == 'draw_card':
                if player_id != current_turn:
                    conn.close(); return err('Не ваш ход')
                if not deck:
                    conn.close(); return err('Колода пуста')
                card = deck.pop(0)
                hands[player_id] = hands.get(player_id, []) + [card]
                # Move to next player
                step = direction
                next_idx = (cur_idx + step) % len(player_ids)
                next_pid = player_ids[next_idx]
                state.update({'hands': hands, 'deck': deck})
                save_session(cur, session_id, state=state, current_turn=next_pid)
                conn.commit(); conn.close()
                return ok({'status': 'playing', 'state': state, 'current_turn': next_pid, 'pot': pot})

    # ── RESET ─────────────────────────────────────────────────
    if action == 'reset':
        save_session(cur, session_id, status='waiting', state={}, current_turn=None, pot=0)
        conn.commit(); conn.close()
        return ok({'status': 'waiting', 'state': {}, 'current_turn': None, 'pot': 0})

    conn.close()
    return err('Unknown action')
