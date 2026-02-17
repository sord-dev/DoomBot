import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { database } from '../database/database';
import { validateAndNormalizeSteamId } from '../utils/steam';
import { leetifyApi, LeetifyPlayerProfile } from '../services/leetify';
import { 
  gradeKillDeathRatio, 
  gradeDamagePerRound, 
  gradeHeadshotPercentage, 
  gradeWinRate, 
  gradeAverageRating,
  gradeFirstKillRate,
  gradeClutchRate,
  calculateOverallGrade,
  getOverallEmbedColor,
  formatGradedStat 
} from '../utils/grading';
import { logger } from '../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show comprehensive CS2 player statistics with grades')
    .addStringOption(option =>
      option
        .setName('player')
        .setDescription('Steam ID or player (leave empty to use your linked account)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const playerInput = interaction.options.getString('player');
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
              '• Or specify a Steam ID: `/stats <steam_id>`'
            );
          
          await interaction.editReply({ embeds: [noLinkEmbed] });
          return;
        }
        steamId = user.steam_id;
      }

      // Fetch player stats from Leetify
      const playerProfile = await leetifyApi.getPlayerProfile(steamId);
      
      // Generate stats embed
      const statsEmbed = await createStatsEmbed(playerProfile);
      
      await interaction.editReply({ embeds: [statsEmbed] });

    } catch (error) {
      logger.error('Error in stats command:', {
        error: error instanceof Error ? error.message : error,
        discordId,
        playerInput,
        stack: error instanceof Error ? error.stack : undefined
      });

      let errorMessage = 'An error occurred while fetching player statistics.';
      
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
        .setTitle('❌ Error Fetching Stats')
        .setDescription(errorMessage)
        .setFooter({ text: 'If the problem persists, please contact support.' });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

async function createStatsEmbed(profile: LeetifyPlayerProfile): Promise<EmbedBuilder> {
  // Grade all the stats
  const kdGrade = gradeKillDeathRatio(profile.killDeathRatio);
  const adrGrade = gradeDamagePerRound(profile.damagePerRound);
  const hsGrade = gradeHeadshotPercentage(profile.headshotPercentage);
  const winGrade = gradeWinRate(profile.winRate); // Data is now decimal internally
  const ratingGrade = gradeAverageRating(profile.averageRating);
  const firstKillGrade = gradeFirstKillRate(profile.firstKillRate); // Data is now decimal internally
  const clutchGrade = gradeClutchRate(profile.clutchRate); // Data is now decimal internally

  // Calculate overall grade including all key stats
  const overallGrade = calculateOverallGrade({
    kdRatio: profile.killDeathRatio,
    adr: profile.damagePerRound,
    rating: profile.averageRating,
    winRate: profile.winRate,
    headshotPercentage: profile.headshotPercentage,
    firstKillRate: profile.firstKillRate,
    clutchRate: profile.clutchRate
  });

  const embedColor = getOverallEmbedColor(overallGrade.grade);
  
  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${profile.nickname}'s CS2 Performance Analysis`)
    .setURL(profile.steamId ? `https://steamcommunity.com/profiles/${profile.steamId}` : null)
    .setThumbnail(profile.profileImageUrl || null)
    .setDescription(`**Leetify Rating:** ${formatGradedStat(ratingGrade, 'Rating')} • ${profile.gamesCount.toLocaleString()} Total Games`)
    .addFields(
      {
        name: '**Core Performance** (Last 30 Games)',
        value: 
          `**K/D Ratio:** ${formatGradedStat(kdGrade, 'K/D')}\n` +
          `**Average Damage/Round:** ${formatGradedStat(adrGrade, 'Damage')}\n` +
          `**Headshot Accuracy:** ${formatGradedStat(hsGrade, 'Headshots')}`,
        inline: false
      },
      {
        name: '**Match Impact**',
        value:
          `**Win Rate:** ${formatGradedStat(winGrade, 'Wins')}\n` +
          `**Entry Fragging:** ${profile.firstKillRate.toFixed(1)}% (${firstKillGrade.grade.emoji} ${firstKillGrade.grade.grade})\n` +
          `**Clutch Success:** ${profile.clutchRate.toFixed(1)}% (${clutchGrade.grade.emoji} ${clutchGrade.grade.grade})`,
        inline: true
      },
      {
        name: '**Areas to Improve**',
        value:
          `**Survival Rate:** ${profile.survivalRate}%\n` +
          `**Multi-Kill Rounds:** ${profile.multiKillRate.toFixed(1)}%\n` +
          `**Utility Damage:** ${profile.utilityDamage.toFixed(1)} per round`,
        inline: true
      },
      {
        name: '**DoomSquad Grade**',
        value: `${overallGrade.grade.emoji} **Grade ${overallGrade.grade.grade}** - ${overallGrade.grade.description}\\n\\n*Use \`/help stats\` to see how this grade is calculated*`,
        inline: false
      }
    )
    .setFooter({ 
      text: 'Based on last 30 competitive matches • Powered by Leetify API', 
      iconURL: 'https://cdn.discordapp.com/icons/682248799567937590/a_0dbcbf9f61ae4aa9a14c82e9e3daa46f.gif' 
    })
    .setTimestamp(new Date(profile.lastUpdated));

  return embed;
}

export default command;