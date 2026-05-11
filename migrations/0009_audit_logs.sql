CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  target_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
