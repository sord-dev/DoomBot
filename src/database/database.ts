import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';

export interface UserRecord {
  id: number;
  discord_id: string;
  steam_id: string;
  steam_profile_url?: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
  preferences: string;
}

export interface CacheRecord {
  id: number;
  cache_key: string;
  data: string;
  expires_at: string;
  created_at: string;
}

export interface GuildSettingsRecord {
  id: number;
  guild_id: string;
  settings: string;
  created_at: string;
  updated_at: string;
}

export interface UserWatchRecord {
  id: number;
  discord_id: string;
  channel_id: string;
  guild_id: string;
  steam_id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserLastMatchRecord {
  id: number;
  discord_id: string;
  steam_id: string;
  last_match_id: string | null;
  last_match_date: string | null;
  last_checked: string;
  updated_at: string;
}

class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env.DATABASE_PATH || './data/doombot.db';
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign keys and WAL mode for better performance
      await this.db.exec('PRAGMA foreign_keys = ON');
      await this.db.exec('PRAGMA journal_mode = WAL');

      // Run migrations
      await this.runMigrations();

      logger.info(`Database initialized at ${this.dbPath}`);
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf-8');
      await this.db!.exec(schema);
      logger.info('Database migrations completed');
    } catch (error) {
      logger.error('Failed to run migrations:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  // User management methods
  async getUserByDiscordId(discordId: string): Promise<UserRecord | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('SELECT * FROM users WHERE discord_id = ?', discordId);
  }

  async getUserBySteamId(steamId: string): Promise<UserRecord | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('SELECT * FROM users WHERE steam_id = ?', steamId);
  }

  async createUser(userData: {
    discord_id: string;
    steam_id: string;
    steam_profile_url?: string;
    display_name?: string;
    preferences?: object;
  }): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      `INSERT INTO users (discord_id, steam_id, steam_profile_url, display_name, preferences)
       VALUES (?, ?, ?, ?, ?)`,
      userData.discord_id,
      userData.steam_id,
      userData.steam_profile_url || null,
      userData.display_name || null,
      JSON.stringify(userData.preferences || {})
    );
    
    return result.lastID!;
  }

  async updateUser(discordId: string, updates: Partial<{
    steam_id: string;
    steam_profile_url: string;
    display_name: string;
    preferences: object;
  }>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'preferences') {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    });
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(discordId);
    
    await this.db.run(
      `UPDATE users SET ${fields.join(', ')} WHERE discord_id = ?`,
      values
    );
  }

  async deleteUser(discordId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run('DELETE FROM users WHERE discord_id = ?', discordId);
  }

  // Cache management methods
  async getCache(cacheKey: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const record = await this.db.get(
      'SELECT data FROM api_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP',
      cacheKey
    );
    
    return record ? JSON.parse(record.data) : null;
  }

  async setCache(cacheKey: string, data: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    
    await this.db.run(
      `INSERT OR REPLACE INTO api_cache (cache_key, data, expires_at)
       VALUES (?, ?, ?)`,
      cacheKey,
      JSON.stringify(data),
      expiresAt
    );
  }

  async clearExpiredCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run('DELETE FROM api_cache WHERE expires_at <= CURRENT_TIMESTAMP');
  }

  // Guild settings methods
  async getGuildSettings(guildId: string): Promise<object> {
    if (!this.db) throw new Error('Database not initialized');
    
    const record = await this.db.get(
      'SELECT settings FROM guild_settings WHERE guild_id = ?',
      guildId
    );
    
    return record ? JSON.parse(record.settings) : {};
  }

  async setGuildSettings(guildId: string, settings: object): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `INSERT OR REPLACE INTO guild_settings (guild_id, settings, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      guildId,
      JSON.stringify(settings)
    );
  }

  // Analytics methods
  async logCommand(commandData: {
    command_name: string;
    user_id: string;
    guild_id?: string;
    execution_time_ms?: number;
    success?: boolean;
    error_message?: string;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `INSERT INTO command_usage (command_name, user_id, guild_id, execution_time_ms, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      commandData.command_name,
      commandData.user_id,
      commandData.guild_id || null,
      commandData.execution_time_ms || null,
      commandData.success !== false,
      commandData.error_message || null
    );
  }

  // User watch methods
  async setUserWatch(discordId: string, channelId: string, guildId: string, steamId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `INSERT OR REPLACE INTO user_watches 
       (discord_id, channel_id, guild_id, steam_id, enabled, updated_at)
       VALUES (?, ?, ?, ?, true, CURRENT_TIMESTAMP)`,
      discordId, channelId, guildId, steamId
    );
  }

  async getUserWatch(discordId: string, channelId: string): Promise<UserWatchRecord | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get(
      'SELECT * FROM user_watches WHERE discord_id = ? AND channel_id = ?',
      discordId, channelId
    );
  }

  async getUserWatches(discordId: string, guildId?: string): Promise<UserWatchRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    if (guildId) {
      return this.db.all(
        'SELECT * FROM user_watches WHERE discord_id = ? AND guild_id = ? AND enabled = true',
        discordId, guildId
      );
    } else {
      return this.db.all(
        'SELECT * FROM user_watches WHERE discord_id = ? AND enabled = true',
        discordId
      );
    }
  }

  async removeUserWatch(discordId: string, channelId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run(
      'DELETE FROM user_watches WHERE discord_id = ? AND channel_id = ?',
      discordId, channelId
    );
  }

  async getAllActiveWatches(): Promise<UserWatchRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.all('SELECT * FROM user_watches WHERE enabled = true');
  }

  // Last match tracking methods
  async updateLastMatch(discordId: string, steamId: string, matchId: string, matchDate: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `INSERT OR REPLACE INTO user_last_matches 
       (discord_id, steam_id, last_match_id, last_match_date, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      discordId, steamId, matchId, matchDate
    );
  }

  async getLastMatch(discordId: string, steamId: string): Promise<UserLastMatchRecord | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get(
      'SELECT * FROM user_last_matches WHERE discord_id = ? AND steam_id = ?',
      discordId, steamId
    );
  }

  async getUsersForMatchMonitoring(): Promise<Array<{ discord_id: string; steam_id: string; last_match_id: string | null; last_match_date: string | null; }>> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Get all users with active watches that haven't been checked recently
    return this.db.all(`
      SELECT DISTINCT w.discord_id, w.steam_id, lm.last_match_id, lm.last_match_date
      FROM user_watches w
      LEFT JOIN user_last_matches lm ON w.discord_id = lm.discord_id AND w.steam_id = lm.steam_id
      WHERE w.enabled = true 
      AND (lm.last_checked IS NULL OR lm.last_checked < datetime('now', '-15 minutes'))
      ORDER BY lm.last_checked ASC
    `);
  }

  async updateLastChecked(discordId: string, steamId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `INSERT OR REPLACE INTO user_last_matches 
       (discord_id, steam_id, last_checked, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      discordId, steamId
    );
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.get('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

export const database = new DatabaseManager();
export default database;