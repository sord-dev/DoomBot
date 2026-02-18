import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { database } from '../database/database';
import { validateAndNormalizeSteamId } from '../utils/steam';
import { leetifyApi } from '../services/leetify';
import { logger } from '../utils/logger';
import { buildImprovementReport } from '../utils/cs2Analysis';
import { buildImprovementEmbed } from '../utils/improvementEmbed';
import type { RawLeetifyProfile } from '../types/improvement';

// ─── command ─────────────────────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('improve')
    .setDescription('Get a personalised improvement report based on your last 30 games')
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
        const user = await database.getUserByDiscordId(discordId);
        if (!user) {
          const noLinkEmbed = new EmbedBuilder()
            .setColor(0xFFAAAA)
            .setTitle('🔗 No Linked Account')
            .setDescription(
              'You don\'t have a Steam account linked. Either:\n\n' +
              '• Use `/link <steam_id>` to link your account\n' +
              '• Or specify a Steam ID: `/improve <steam_id>`'
            );
          await interaction.editReply({ embeds: [noLinkEmbed] });
          return;
        }
        steamId = user.steam_id;
      }

      // hit the profile endpoint to get raw rating + stats sub-metrics
      const rawProfile: RawLeetifyProfile = await leetifyApi.getRawProfile(steamId);

      if (!rawProfile?.rating || !rawProfile?.stats) {
        const noDataEmbed = new EmbedBuilder()
          .setColor(0xFFAAAA)
          .setTitle('📊 No Data Available')
          .setDescription(
            'Could not find enough data to generate an improvement report.\n\n' +
            'Make sure this player has recent CS2 matches on Leetify.'
          );
        await interaction.editReply({ embeds: [noDataEmbed] });
        return;
      }

      const report = buildImprovementReport(rawProfile);
      const embed = buildImprovementEmbed(report, steamId, rawProfile);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in improve command:', {
        error: error instanceof Error ? error.message : error,
        discordId,
        playerInput,
        stack: error instanceof Error ? error.stack : undefined
      });

      let errorMessage = 'An error occurred while generating your improvement report.';

      if (error && typeof error === 'object' && 'code' in error) {
        switch ((error as any).code) {
          case 404:
            errorMessage = 'Player not found. Check the Steam ID and make sure they have CS2 data on Leetify.';
            break;
          case 429:
            errorMessage = 'Rate limit hit. Try again in a few minutes.';
            break;
          case 401:
            errorMessage = 'API authentication issue. Contact the bot admin.';
            break;
        }
      }

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(errorMessage);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

export default command;