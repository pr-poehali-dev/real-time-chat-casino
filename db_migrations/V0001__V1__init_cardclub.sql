
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(32) NOT NULL,
  avatar VARCHAR(8) NOT NULL,
  coins INTEGER NOT NULL DEFAULT 100,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW()
);

CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(16) NOT NULL DEFAULT 'blackjack',
  status VARCHAR(16) NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE table_seats (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id),
  seat_index INTEGER NOT NULL,
  player_id UUID REFERENCES players(id),
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  player_name VARCHAR(32) NOT NULL,
  player_avatar VARCHAR(8) NOT NULL,
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_created ON chat_messages(created_at DESC);
CREATE INDEX idx_players_coins ON players(coins DESC);
CREATE INDEX idx_seats_session ON table_seats(session_id);
