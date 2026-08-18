-- Initial migration for Personal Kindle PDF Reader

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  page_count INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_progress (
  book_id TEXT PRIMARY KEY,
  current_page INTEGER NOT NULL DEFAULT 1,
  progress_percentage REAL NOT NULL DEFAULT 0,
  scroll_position REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reader_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL DEFAULT 'light',
  brightness REAL NOT NULL DEFAULT 1,
  zoom REAL NOT NULL DEFAULT 1,
  reading_mode TEXT NOT NULL DEFAULT 'continuous',
  page_width TEXT NOT NULL DEFAULT 'comfortable',
  show_controls INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO reader_settings (id, theme, brightness, zoom, reading_mode, page_width, show_controls, updated_at)
VALUES (1, 'light', 1.0, 1.0, 'continuous', 'comfortable', 1, datetime('now'));
