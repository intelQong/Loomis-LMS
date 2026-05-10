CREATE TABLE IF NOT EXISTS installments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', -- pending, paid, overdue
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_installments_user ON installments(user_id, due_date ASC);
