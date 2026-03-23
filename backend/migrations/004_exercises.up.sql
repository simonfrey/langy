CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  source_card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  level INT NOT NULL,
  instruction TEXT NOT NULL,
  prompt TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  hint TEXT,
  options JSONB,
  completed BOOLEAN DEFAULT false,
  user_answer TEXT,
  correct BOOLEAN,
  feedback TEXT,
  next_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_exercises_card ON exercises(source_card_id);
CREATE INDEX idx_exercises_next_review ON exercises(next_review);
CREATE INDEX idx_exercises_user ON exercises(user_id);
