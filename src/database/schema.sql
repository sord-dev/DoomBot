-- Database schema for doombot
-- SQLite database schema

-- Users table to store Discord user associations with Steam accounts
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT UNIQUE NOT NULL,
    steam_id TEXT NOT NULL,
    steam_profile_url TEXT,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    preferences TEXT DEFAULT '{}' -- JSON string for user preferences
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_steam_id ON users(steam_id);

-- Cache table for API responses to reduce rate limiting
CREATE TABLE IF NOT EXISTS api_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL, -- JSON string of cached data
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for cache lookups
CREATE INDEX IF NOT EXISTS idx_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);

-- Guild settings table for Discord server preferences
CREATE TABLE IF NOT EXISTS guild_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT UNIQUE NOT NULL,
    settings TEXT DEFAULT '{}', -- JSON string for guild-specific settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for guild lookups
CREATE INDEX IF NOT EXISTS idx_guild_settings_guild_id ON guild_settings(guild_id);

-- Stats tracking table (optional - for bot usage analytics)
CREATE TABLE IF NOT EXISTS command_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Create index for analytics
CREATE INDEX IF NOT EXISTS idx_command_usage_command ON command_usage(command_name);
CREATE INDEX IF NOT EXISTS idx_command_usage_date ON command_usage(executed_at);

-- Guild notification settings for automatic match posting
CREATE TABLE IF NOT EXISTS user_watches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    steam_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(discord_id, channel_id)
);

-- Create index for watch lookups
CREATE INDEX IF NOT EXISTS idx_user_watches_discord ON user_watches(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_watches_channel ON user_watches(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_watches_guild ON user_watches(guild_id);

-- Track last seen matches to detect new ones
CREATE TABLE IF NOT EXISTS user_last_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    steam_id TEXT NOT NULL,
    last_match_id TEXT,
    last_match_date DATETIME,
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(discord_id, steam_id)
);

-- Create index for match tracking
CREATE INDEX IF NOT EXISTS idx_last_matches_discord ON user_last_matches(discord_id);
CREATE INDEX IF NOT EXISTS idx_last_matches_steam ON user_last_matches(steam_id);
CREATE INDEX IF NOT EXISTS idx_last_matches_checked ON user_last_matches(last_checked);