CREATE TABLE IF NOT EXISTS sheets (
  id TEXT PRIMARY KEY,
  edit_token_hash TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sheets_updated_at_idx ON sheets (updated_at);

CREATE TABLE IF NOT EXISTS product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  sheet_id TEXT,
  is_automated INTEGER NOT NULL DEFAULT 0 CHECK (is_automated IN (0, 1)),
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS product_events_session_idx
  ON product_events (session_hash, created_at);
CREATE INDEX IF NOT EXISTS product_events_name_idx
  ON product_events (name, created_at);
