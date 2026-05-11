CREATE TABLE IF NOT EXISTS academic_calendar (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT DEFAULT 'event', -- event, holiday, exam
  desc TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed with some example data
INSERT INTO academic_calendar (id, title, date, type, desc) VALUES
('c1', 'IELTS Mock Test', '2026-05-15', 'exam', 'Monthly evaluation mock test for all regular students.'),
('c2', 'Friday Holiday', '2026-05-22', 'holiday', 'Weekly holiday for AIMS English.'),
('c3', 'Language Lounge Special', '2026-05-25', 'event', 'Special guest session in the language lounge.');
