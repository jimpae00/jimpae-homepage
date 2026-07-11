CREATE TABLE IF NOT EXISTS twitch_sub_entitlements (
  twitch_user_id TEXT PRIMARY KEY,
  is_subscriber INTEGER NOT NULL DEFAULT 0,
  tier TEXT,
  checked_at TEXT NOT NULL,
  valid_until TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_twitch_sub_entitlements_valid_until
ON twitch_sub_entitlements(valid_until);

CREATE TABLE IF NOT EXISTS member_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  stream_uid TEXT NOT NULL UNIQUE,
  thumbnail_url TEXT,
  published_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_videos_enabled_sort
ON member_videos(enabled, sort_order, published_at);
