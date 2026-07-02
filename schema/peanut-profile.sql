CREATE TABLE IF NOT EXISTS viewer_profiles (
  viewer_id INTEGER PRIMARY KEY,
  twitch_user_id TEXT UNIQUE,
  twitch_login TEXT,
  twitch_display_name TEXT,
  youtube_channel_id TEXT UNIQUE,
  youtube_handle TEXT,
  youtube_display_name TEXT,
  discord_user_id TEXT UNIQUE,
  discord_username TEXT,
  discord_linked INTEGER NOT NULL DEFAULT 0,
  points INTEGER,
  points_rank INTEGER,
  points_platform TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS peanut_ownerships (
  viewer_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  source_platform TEXT,
  created_at TEXT,
  PRIMARY KEY (viewer_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_viewer_profiles_twitch_user_id
ON viewer_profiles(twitch_user_id);

CREATE INDEX IF NOT EXISTS idx_viewer_profiles_youtube_channel_id
ON viewer_profiles(youtube_channel_id);

CREATE INDEX IF NOT EXISTS idx_viewer_profiles_discord_user_id
ON viewer_profiles(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_peanut_ownerships_viewer_id
ON peanut_ownerships(viewer_id);

CREATE TABLE IF NOT EXISTS pending_discord_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twitch_user_id TEXT,
  twitch_login TEXT,
  youtube_channel_id TEXT,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_discord_links_status
ON pending_discord_links(status, id);

CREATE TABLE IF NOT EXISTS pending_youtube_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_channel_id TEXT NOT NULL,
  youtube_handle TEXT,
  youtube_display_name TEXT,
  twitch_user_id TEXT,
  discord_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_youtube_links_status
ON pending_youtube_links(status, id);

CREATE TABLE IF NOT EXISTS pending_unlinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id INTEGER,
  session_provider TEXT,
  session_subject TEXT,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  applied_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pending_unlinks_status
ON pending_unlinks(status, id);

CREATE TABLE IF NOT EXISTS pending_twitch_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twitch_user_id TEXT NOT NULL,
  twitch_login TEXT,
  twitch_display_name TEXT,
  youtube_channel_id TEXT,
  discord_user_id TEXT,
  current_viewer_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_twitch_links_status
ON pending_twitch_links(status, id);

CREATE TABLE IF NOT EXISTS pending_test_deductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id INTEGER NOT NULL,
  session_provider TEXT,
  session_subject TEXT,
  amount INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_test_deductions_status
ON pending_test_deductions(status, id);

CREATE TABLE IF NOT EXISTS pending_peanut_redeems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  session_provider TEXT,
  session_subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_peanut_redeems_status
ON pending_peanut_redeems(status, id);

ALTER TABLE pending_twitch_links ADD COLUMN current_viewer_id INTEGER;
