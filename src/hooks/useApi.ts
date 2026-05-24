const URLS = {
  players: 'https://functions.poehali.dev/5a6530c3-8f0a-48e6-be5f-0253c00d47e1',
  chat: 'https://functions.poehali.dev/0e6e282d-54d9-41af-917f-813b0099de97',
  leaderboard: 'https://functions.poehali.dev/2b8e6b97-c34c-47ef-b3ee-f267956316e2',
  table: 'https://functions.poehali.dev/fc573b81-c4c8-478b-bb98-9da78a27b97d',
  game: 'https://functions.poehali.dev/436ea5a3-8452-48e4-ac82-669f2803509e',
};

export const api = {
  async registerPlayer(name: string, avatar: string) {
    const r = await fetch(URLS.players, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatar }),
    });
    return r.json();
  },

  async getPlayer(id: string) {
    const r = await fetch(`${URLS.players}?id=${id}`);
    return r.json();
  },

  async updateCoins(playerId: string, delta: number, isWin?: boolean) {
    const r = await fetch(URLS.players, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, coins_delta: delta, is_win: isWin }),
    });
    return r.json();
  },

  async getMessages(since?: string) {
    const url = since ? `${URLS.chat}?since=${since}&limit=50` : `${URLS.chat}?limit=50`;
    const r = await fetch(url);
    const data = await r.json();
    return data.messages || [];
  },

  async sendMessage(playerId: string, playerName: string, playerAvatar: string, isVip: boolean, text: string) {
    const r = await fetch(URLS.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, player_name: playerName, player_avatar: playerAvatar, is_vip: isVip, text }),
    });
    return r.json();
  },

  async getLeaderboard() {
    const r = await fetch(URLS.leaderboard);
    const data = await r.json();
    return data.leaders || [];
  },

  async getTable() {
    const r = await fetch(URLS.table);
    return r.json();
  },

  async takeSeat(sessionId: string, playerId: string, seatIndex: number) {
    const r = await fetch(URLS.table, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'take_seat', session_id: sessionId, player_id: playerId, seat_index: seatIndex }),
    });
    return r.json();
  },

  async leaveSeat(sessionId: string, playerId: string) {
    const r = await fetch(URLS.table, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave_seat', session_id: sessionId, player_id: playerId }),
    });
    return r.json();
  },

  async changeGame(sessionId: string, playerId: string, gameId: string) {
    const r = await fetch(URLS.table, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_game', session_id: sessionId, player_id: playerId, game_id: gameId }),
    });
    return r.json();
  },

  async getGameState(sessionId: string) {
    const r = await fetch(`${URLS.game}?session_id=${sessionId}`);
    return r.json();
  },

  async gameAction(sessionId: string, playerId: string, action: string, extra: Record<string, unknown> = {}) {
    const r = await fetch(URLS.game, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, player_id: playerId, action, ...extra }),
    });
    return r.json();
  },
};