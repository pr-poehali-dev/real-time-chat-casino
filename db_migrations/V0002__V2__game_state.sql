
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS round_state JSONB DEFAULT '{}';
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS current_turn UUID;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS pot INTEGER DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE game_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id),
  player_id UUID REFERENCES players(id),
  action_type VARCHAR(32) NOT NULL,
  action_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_actions_session ON game_actions(session_id, created_at DESC);
