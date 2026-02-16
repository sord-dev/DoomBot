import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { database } from '../database/database';
import { validateAndNormalizeSteamId } from '../utils/steam';
import { leetifyApi, LeetifyMatchSummary } from '../services/leetify';
import { logger } from '../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('recent')
    .setDescription('Show recent CS2 match performance')
    .addStringOption(option =>
      option
        .setName('player')
        .setDescription('Steam ID or player (leave empty to use your linked account)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('matches')
        .setDescription('Number of recent matches to show (1-10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const playerInput = interaction.options.getString('player');
    const matchCount = interaction.options.getInteger('matches') || 5;
    const discordId = interaction.user.id;

    await interaction.deferReply();

    try {
      let steamId: string;

      if (playerInput) {
        // Validate provided Steam ID
        const steamInfo = validateAndNormalizeSteamId(playerInput);
        if (!steamInfo.isValid) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Invalid Steam ID')
            .setDescription(
              'Please provide a valid Steam ID format:\n' +
              '• Steam64 ID: `76561198123456789`\n' +
              '• Steam32 ID: `123456789`\n' +
              '• SteamID: `STEAM_0:1:61728394`\n' +
              '• Profile URL: `https://steamcommunity.com/profiles/76561198123456789`'
            );
          
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }
        steamId = steamInfo.steam64;
      } else {
        // Use linked account
        const user = await database.getUserByDiscordId(discordId);
        if (!user) {
          const noLinkEmbed = new EmbedBuilder()
            .setColor(0xFFAAAA)
            .setTitle('🔗 No Linked Account')
            .setDescription(
              'You don\'t have a Steam account linked. Please either:\n\n' +
              '• Use `/link <steam_id>` to link your account\n' +
              '• Or specify a Steam ID: `/recent <steam_id>`'
            );
          
          await interaction.editReply({ embeds: [noLinkEmbed] });
          return;
        }
        steamId = user.steam_id;
      }

      // Fetch recent matches from Leetify
      const recentMatches = await leetifyApi.getPlayerMatches(steamId, matchCount);
      
      if (!recentMatches || recentMatches.length === 0) {
        const noMatchesEmbed = new EmbedBuilder()
          .setColor(0xFFAAAA)
          .setTitle('📊 No Recent Matches')
          .setDescription(
            'No recent matches found for this player. This could mean:\n\n' +
            '• No recent CS2 matches played\n' +
            '• Matches not yet processed by Leetify\n' +
            '• Private profile or limited data access'
          )
          .setFooter({ text: 'Match data is provided by Leetify API' });
        
        await interaction.editReply({ embeds: [noMatchesEmbed] });
        return;
      }

      // Generate recent matches embed
      const recentEmbed = await createRecentMatchesEmbed(recentMatches, steamId);
      
      await interaction.editReply({ embeds: [recentEmbed] });

    } catch (error) {
      logger.error('Error in recent command:', {
        error: error instanceof Error ? error.message : error,
        discordId,
        playerInput,
        matchCount,
        stack: error instanceof Error ? error.stack : undefined
      });

      let errorMessage = 'An error occurred while fetching recent matches.';
      
      if (error && typeof error === 'object' && 'code' in error) {
        switch (error.code) {
          case 404:
            errorMessage = 'Player not found. Please check the Steam ID and ensure the player has CS2 data on Leetify.';
            break;
          case 429:
            errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
            break;
          case 401:
            errorMessage = 'API authentication issue. Please contact the bot administrator.';
            break;
        }
      }

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error Fetching Recent Matches')
        .setDescription(errorMessage)
        .setFooter({ text: 'If the problem persists, please contact support.' });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

async function createRecentMatchesEmbed(matches: LeetifyMatchSummary[], steamId: string): Promise<EmbedBuilder> {
  // Calculate summary stats
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.matchResult === 'win').length;
  const winRate = Math.round((wins / totalMatches) * 100);
  
  const avgRating = matches.reduce((sum, m) => sum + m.rating, 0) / totalMatches;
  const avgKD = matches.reduce((sum, m) => sum + (m.kills / Math.max(m.deaths, 1)), 0) / totalMatches;
  const avgADR = matches.reduce((sum, m) => sum + m.adr, 0) / totalMatches;

  // Determine embed color based on recent performance
  let embedColor = 0x808080; // Default gray
  if (winRate >= 70) embedColor = 0x00FF00; // Green for high win rate
  else if (winRate >= 50) embedColor = 0xFFFF00; // Yellow for decent win rate
  else if (winRate < 40) embedColor = 0xFF0000; // Red for poor win rate

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🏆 Recent Match Performance (${totalMatches} matches)`)
    .setURL(`https://steamcommunity.com/profiles/${steamId}`)
    .addFields(
      {
        name: '📈 **Recent Form Summary**',
        value: 
          `**Win Rate:** ${winRate}% (${wins}W/${totalMatches - wins}L)\n` +
          `**Avg Rating:** ${avgRating.toFixed(2)}\n` +
          `**Avg K/D:** ${avgKD.toFixed(2)}\n` +
          `**Avg ADR:** ${avgADR.toFixed(1)}`,
        inline: true
      }
    );

  // Add individual match details
  const matchFields = matches.slice(0, 5).map((match, index) => {
    const resultEmoji = match.matchResult === 'win' ? '✅' : match.matchResult === 'loss' ? '❌' : '⚪';
    const kdRatio = (match.kills / Math.max(match.deaths, 1)).toFixed(1);
    const matchDate = new Date(match.matchDate).toLocaleDateString();
    
    const ratingColor = getRatingColor(match.rating);
    
    return {
      name: `${resultEmoji} **Match ${index + 1}** - ${match.mapName}`,
      value: 
        `**Score:** ${match.playerScore}-${match.opponentScore}\n` +
        `**K/D/A:** ${match.kills}/${match.deaths}/${match.assists} (${kdRatio})\n` +
        `**Rating:** ${ratingColor} ${match.rating.toFixed(2)}\n` +
        `**ADR:** ${match.adr.toFixed(0)} • **HS%:** ${match.headshotPercentage.toFixed(0)}%\n` +
        `**Date:** ${matchDate}`,
      inline: true
    };
  });

  embed.addFields(...matchFields);

  // Add performance indicators
  const performanceIndicators = [];
  if (avgRating >= 1.10) performanceIndicators.push('🔥 Hot streak');
  if (avgKD >= 1.20) performanceIndicators.push('⚔️ High fragging');
  if (winRate >= 70) performanceIndicators.push('🏆 Great form');
  if (avgADR >= 75) performanceIndicators.push('💥 High impact');
  
  const recentStreak = calculateStreak(matches);
  if (recentStreak.length > 1) {
    const streakType = recentStreak[0] === 'win' ? 'W' : 'L';
    performanceIndicators.push(`📊 ${recentStreak.length}${streakType} streak`);
  }

  if (performanceIndicators.length > 0) {
    embed.addFields({
      name: '🎯 **Performance Indicators**',
      value: performanceIndicators.join(' • '),
      inline: false
    });
  }

  embed.setFooter({ 
    text: 'Powered by Leetify API • Recent performance analysis',
    iconURL: 'https://cdn.discordapp.com/icons/682248799567937590/a_0dbcbf9f61ae4aa9a14c82e9e3daa46f.gif' 
  })
  .setTimestamp();

  return embed;
}

function getRatingColor(rating: number): string {
  if (rating >= 1.30) return '🔥'; // Exceptional
  if (rating >= 1.15) return '⭐'; // Excellent
  if (rating >= 1.05) return '✨'; // Good
  if (rating >= 0.95) return '👍'; // Average
  if (rating >= 0.85) return '👎'; // Below average
  return '💀'; // Poor
}

function calculateStreak(matches: LeetifyMatchSummary[]): string[] {
  if (matches.length === 0) return [];
  
  const streak = [matches[0].matchResult];
  const firstResult = matches[0].matchResult;
  
  for (let i = 1; i < matches.length; i++) {
    if (matches[i].matchResult === firstResult) {
      streak.push(matches[i].matchResult);
    } else {
      break;
    }
  }
  
  return streak;
}

export default command;