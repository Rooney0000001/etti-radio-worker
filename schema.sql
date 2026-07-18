-- ETTI Radio database schema for Cloudflare D1

CREATE TABLE IF NOT EXISTS live_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  live_url TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Ensure exactly one row always exists
INSERT OR IGNORE INTO live_status (id, live_url) VALUES (1, '');

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT DEFAULT '',
  video_url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
