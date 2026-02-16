import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { database } from '../database/database';
import { validateAndNormalizeSteamId, formatSteamIds } from '../utils/steam';
import { logger } from '../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your Steam account')
    .addStringOption(option =>
      option
        .setName('steam_id')
        .setDescription('Your Steam ID (Steam64, Steam32, SteamID format, or profile URL)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const steamInput = interaction.options.getString('steam_id', true);
    const discordId = interaction.user.id;

    // Defer reply as Steam ID validation might take a moment
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Validate and normalize the Steam ID
      const steamInfo = validateAndNormalizeSteamId(steamInput);
      
      if (!steamInfo.isValid) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000) // Red
          .setTitle('❌ Invalid Steam ID')
          .setDescription(
            'The provided Steam ID is not valid. Please use one of these formats:\n\n' +
            '• **Steam64 ID:** `76561198123456789`\n' +
            '• **Steam32 ID:** `123456789`\n' +
            '• **SteamID:** `STEAM_0:1:61728394`\n' +
            '• **Profile URL:** `https://steamcommunity.com/profiles/76561198123456789`'
          )
          .setFooter({ text: 'Need help finding your Steam ID? Check your Steam profile URL!' });

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Check if user is already linked
      const existingUser = await database.getUserByDiscordId(discordId);
      
      if (existingUser) {
        // Update existing link
        await database.updateUser(discordId, {
          steam_id: steamInfo.steam64,
          steam_profile_url: steamInfo.profileUrl,
          display_name: interaction.user.displayName
        });

        const updateEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Green
          .setTitle('✅ Steam Account Updated')
          .setDescription(
            `Successfully updated your linked Steam account!\n\n` +
            `${formatSteamIds(steamInfo.steam64)}\n\n` +
            `**Profile:** [View Steam Profile](${steamInfo.profileUrl})`
          )
          .setFooter({ text: 'You can now use stat commands without specifying your Steam ID!' });

        await interaction.editReply({ embeds: [updateEmbed] });
        
        logger.info(`User ${interaction.user.tag} updated Steam link`, {
          discordId,
          steam64: steamInfo.steam64,
          oldSteam64: existingUser.steam_id
        });
      } else {
        // Check if this Steam ID is already linked to another Discord account
        const existingSteamUser = await database.getUserBySteamId(steamInfo.steam64);
        
        if (existingSteamUser) {
          const conflictEmbed = new EmbedBuilder()
            .setColor(0xFF0000) // Red
            .setTitle('❌ Steam Account Already Linked')
            .setDescription(
              'This Steam account is already linked to another Discord account.\n\n' +
              'If this is your account and you want to transfer the link, please contact a server administrator.'
            )
            .setFooter({ text: 'Each Steam account can only be linked to one Discord account.' });

          await interaction.editReply({ embeds: [conflictEmbed] });
          return;
        }

        // Create new link
        await database.createUser({
          discord_id: discordId,
          steam_id: steamInfo.steam64,
          steam_profile_url: steamInfo.profileUrl,
          display_name: interaction.user.displayName
        });

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Green
          .setTitle('✅ Steam Account Linked')
          .setDescription(
            `Successfully linked your Steam account!\n\n` +
            `${formatSteamIds(steamInfo.steam64)}\n\n` +
            `**Profile:** [View Steam Profile](${steamInfo.profileUrl})`
          )
          .addFields({
            name: '🎉 What\'s Next?',
            value: '• Use `/stats` to see your CS2 statistics\n' +
                   '• Try `/recent` for your latest match data',
            inline: false
          })
          .setFooter({ text: 'You can now use stat commands without specifying your Steam ID!' });

        await interaction.editReply({ embeds: [successEmbed] });
        
        logger.info(`User ${interaction.user.tag} linked Steam account`, {
          discordId,
          steam64: steamInfo.steam64
        });
      }

    } catch (error) {
      logger.error('Error in link command:', {
        error: error instanceof Error ? error.message : error,
        discordId,
        steamInput,
        stack: error instanceof Error ? error.stack : undefined
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Red
        .setTitle('❌ Error')
        .setDescription('An error occurred while linking your account. Please try again later.')
        .setFooter({ text: 'If the problem persists, please contact support.' });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

export default command;