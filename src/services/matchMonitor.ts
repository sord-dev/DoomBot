import * as cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { database } from '../database/database';
import { leetifyApi, LeetifyMatchSummary } from './leetify';
import { logger } from '../utils/logger';
import {
  gradeKillDeathRatio,
  gradeDamagePerRound,
  gradeAverageRating,
  getOverallEmbedColor,
  formatGradedStat
} from '../utils/grading';

export interface MatchNotification {
  guildId: string;
  channelId: string;
  match: LeetifyMatchSummary;
  discordId: string;
  steamId: string;
}

class MatchMonitorService {
  private client: Client | null = null;
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  initialize(client: Client): void {
    this.client = client;
    
    // Start monitoring every 15 minutes
    // Cron pattern: */15 * * * * = every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      await this.checkForNewMatches();
    }, {
      scheduled: false // Start manually after bot is ready
    });

    logger.info('Match monitoring service initialized');
  }

  start(): void {
    if (this.cronJob && !this.isRunning) {
      this.cronJob.start();
      this.isRunning = true;
      logger.info('Match monitoring service started (checking every 15 minutes)');
    }
  }

  stop(): void {
    if (this.cronJob && this.isRunning) {
      this.cronJob.stop();
      this.isRunning = false;
      logger.info('Match monitoring service stopped');
    }
  }

  async checkForNewMatches(): Promise<void> {
    if (!this.client || !this.client.isReady()) {
      logger.warn('Discord client not ready, skipping match check');
      return;
    }

    try {
      logger.debug('Starting match monitoring cycle...');
      
      // Get all users that need monitoring
      const usersToCheck = await database.getUsersForMatchMonitoring();
      
      if (usersToCheck.length === 0) {
        logger.debug('No users to monitor for matches');
        return;
      }

      logger.info(`Checking for new matches for ${usersToCheck.length} users`);

      // Check each user for new matches
      for (const user of usersToCheck) {
        try {
          await this.checkUserMatches(user);
        } catch (error) {
          logger.error(`Error checking matches for user ${user.discord_id}:`, error);
        }
        
        // Update last checked regardless of success/failure
        await database.updateLastChecked(user.discord_id, user.steam_id);
        
        // Small delay between API calls to respect rate limits
        await this.sleep(1000);
      }

      logger.debug('Match monitoring cycle completed');
    } catch (error) {
      logger.error('Error in match monitoring cycle:', error);
    }
  }

  private async checkUserMatches(
    user: { discord_id: string; steam_id: string; last_match_id: string | null; last_match_date: string | null }
  ): Promise<void> {
    try {
      // Get all active watches for this user to determine cutoff time
      const userWatches = await database.getUserWatches(user.discord_id);
      
      if (userWatches.length === 0) {
        logger.debug(`No active watches for user ${user.discord_id}`);
        return;
      }

      // Find earliest watch start time as cutoff
      const earliestWatchTime = Math.min(
        ...userWatches.map(watch => new Date(watch.created_at).getTime())
      );

      // Fetch recent matches (limit 5 to check for new ones)
      const recentMatches = await leetifyApi.getPlayerMatches(user.steam_id, 5);
      
      if (!recentMatches || recentMatches.length === 0) {
        logger.debug(`No recent matches found for user ${user.discord_id}`);
        return;
      }

      // Filter matches to only include those after watch started and newer than last seen
      const eligibleMatches = recentMatches.filter(match => {
        const matchTime = new Date(match.matchDate).getTime();
        
        // Must be after user started watching
        if (matchTime <= earliestWatchTime) {
          return false;
        }
        
        // Must be newer than last processed match
        if (user.last_match_date) {
          const lastMatchTime = new Date(user.last_match_date).getTime();
          return matchTime > lastMatchTime || match.matchId !== user.last_match_id;
        }
        
        return true;
      });
      
      if (eligibleMatches.length === 0) {
        logger.debug(`No new eligible matches for user ${user.discord_id} since watch started`);
        return;
      }

      logger.info(`Found ${eligibleMatches.length} new matches for user ${user.discord_id} since watch started`);

      // Update last seen match with the most recent eligible match
      const latestMatch = eligibleMatches[0];
      await database.updateLastMatch(
        user.discord_id,
        user.steam_id,
        latestMatch.matchId,
        latestMatch.matchDate
      );

      // Send notification to each watched channel for each new match
      for (const watch of userWatches) {
        for (const match of eligibleMatches) {
          try {
            await this.sendMatchNotification(watch, match, user.steam_id);
          } catch (error) {
            logger.error(`Failed to send notification to channel ${watch.channel_id}:`, error);
          }
        }
      }

    } catch (error) {
      logger.error(`Failed to check matches for user ${user.discord_id}:`, error);
    }
  }

  private async sendMatchNotification(
    watch: { channel_id: string; guild_id: string; steam_id: string; discord_id: string },
    match: LeetifyMatchSummary,
    steamId: string
  ): Promise<void> {
    const channel = this.client!.channels.cache.get(watch.channel_id) as TextChannel;
    
    if (!channel || channel.type !== 0) { // ChannelType.GuildText
      logger.warn(`Channel ${watch.channel_id} not found or not a text channel`);
      return;
    }

    try {
      const embed = await this.createMatchNotificationEmbed(match, watch.discord_id, steamId);
      await channel.send({ embeds: [embed] });
      
      logger.info(`Sent match notification for ${watch.discord_id} to ${channel.guild.name}#${channel.name}`);
    } catch (error) {
      logger.error(`Failed to send match notification:`, error);
    }
  }

  private async createMatchNotificationEmbed(
    match: LeetifyMatchSummary,
    discordId: string,
    steamId: string
  ): Promise<EmbedBuilder> {
    // Get Discord user for display
    const user = this.client!.users.cache.get(discordId);
    const displayName = user?.displayName || 'Unknown Player';
    
    // Grade key stats
    const kdRatio = match.kills / Math.max(match.deaths, 1);
    const kdGrade = gradeKillDeathRatio(kdRatio);
    const adrGrade = gradeDamagePerRound(match.adr);
    const ratingGrade = gradeAverageRating(match.rating);
    
    // Calculate additional stats
    const entryFragRate = match.firstKills > 0 ? (match.firstKills / Math.max(match.matchDurationMinutes, 1) * 100) : 0;
    const clutchRate = match.clutchesWon > 0 ? 100 : 0; // Simple: did they clutch or not
    const roundsPlayed = match.matchDurationMinutes || Math.ceil((match.kills + match.deaths + match.assists) / 3);
    
    // Determine embed color based on result and performance
    let embedColor = 0x808080; // Default gray
    if (match.matchResult === 'win') embedColor = 0x00FF00; // Green
    else if (match.matchResult === 'loss') embedColor = 0xFF6B6B; // Red
    else embedColor = 0xFFDB4D; // Yellow for tie
    
    // Result emoji and performance indicators
    const resultEmoji = match.matchResult === 'win' ? '✅' : 
                       match.matchResult === 'loss' ? '❌' : '⚪';
    
    const matchDate = new Date(match.matchDate).toLocaleDateString();
    const leetifyUrl = `https://leetify.com/app/match-details/${match.matchId}/your-match`;
    
    // Performance indicators
    const indicators = [];
    if (match.rating >= 1.20) indicators.push('🔥 Hot Performance');
    if (kdRatio >= 1.5) indicators.push('⚔️ High Fragging');
    if (match.firstKills >= 3) indicators.push('🎯 Entry Master');
    if (match.clutchesWon >= 2) indicators.push('🏆 Clutch King');
    if (match.headshotPercentage >= 50) indicators.push('💥 Headhunter');
    
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${resultEmoji} **${match.mapName}** - ${displayName}`)
      .setURL(leetifyUrl)
      .setDescription(
        `**Score:** ${match.playerScore}-${match.opponentScore} • **Rounds:** ~${roundsPlayed} • **Date:** ${matchDate}`
      )
      .addFields(
        {
          name: '🎯 **Core Performance**',
          value: 
            `**K/D/A:** ${match.kills}/${match.deaths}/${match.assists} (${kdRatio.toFixed(2)})\n` +
            `**Rating:** ${formatGradedStat(ratingGrade, 'Rating')}\n` +
            `**ADR:** ${formatGradedStat(adrGrade, 'ADR')}\n` +
            `**HS%:** ${match.headshotPercentage.toFixed(0)}%`,
          inline: true
        },
        {
          name: '⚡ **Match Impact**',
          value: 
            `**Entry Frags:** ${match.firstKills} (${entryFragRate.toFixed(1)}%)\n` +
            `**Clutches Won:** ${match.clutchesWon}\n` +
            `**Flash Assists:** ${match.flashAssists}\n` +
            `**Utility Dmg:** ${match.utilityDamage.toFixed(0)}`,
          inline: true
        }
      );

    // Add performance indicators if any
    if (indicators.length > 0) {
      embed.addFields({
        name: '🌟 **Highlights**',
        value: indicators.join(' • '),
        inline: false
      });
    }

    embed.setFooter({ 
      text: `Click title for detailed round-by-round analysis on Leetify`, 
      iconURL: user?.displayAvatarURL() 
    })
    .setTimestamp();

    return embed;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger for testing
  async triggerManualCheck(): Promise<void> {
    logger.info('Manual match check triggered');
    await this.checkForNewMatches();
  }

  getStatus(): { isRunning: boolean; nextRun: string | null } {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? 'Every 15 minutes' : null
    };
  }
}

export const matchMonitor = new MatchMonitorService();
export default matchMonitor;