CREATE TABLE IF NOT EXISTS viewer_profiles (
  twitch_user_id TEXT PRIMARY KEY,
  twitch_login TEXT,
  twitch_display_name TEXT,
  youtube_handle TEXT,
  discord_linked INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS peanut_ownerships (
  twitch_user_id TEXT NOT NULL,
  season_number INTEGER NOT NULL,
  source_platform TEXT,
  created_at TEXT,
  PRIMARY KEY (twitch_user_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_peanut_ownerships_twitch_user_id
ON peanut_ownerships(twitch_user_id);

CREATE TABLE IF NOT EXISTS pending_discord_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twitch_user_id TEXT NOT NULL,
  twitch_login TEXT,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_discord_links_status
ON pending_discord_links(status, id);
