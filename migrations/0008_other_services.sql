CREATE TABLE IF NOT EXISTS other_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  desc TEXT,
  url TEXT NOT NULL,
  icon TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed with initial data from app-data.js
INSERT INTO other_services (id, name, desc, url, icon) VALUES
('s1', 'AIMS English Website', 'Official website with course info, news, and announcements.', 'https://example.com', '🌐'),
('s2', 'Class Schedule', 'View your class timetable and upcoming sessions.', '#schedule', '📅'),
('s3', 'IELTS Practice', 'Access practice tests and band scoring tools.', '#ielts-practice', '📝'),
('s4', 'Study Resources', 'Download study materials, notes and worksheets.', '#resources', '🎓');
