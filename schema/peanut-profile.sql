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
