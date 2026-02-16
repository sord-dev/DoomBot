import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { database } from '../database/database';
import { logger } from '../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Remove the link between your Discord and Steam accounts'),

  async execute(interaction: ChatInputCommandInteraction) {
    const discordId = interaction.user.id;

    try {
      // Check if user has a linked account
      const existingUser = await database.getUserByDiscordId(discordId);
      
      if (!existingUser) {
        const notLinkedEmbed = new EmbedBuilder()
          .setColor(0xFFAAAA) // Light red
          .setTitle('ℹ️ No Linked Account')
          .setDescription(
            'You don\'t have a Steam account linked to your Discord account.\n\n' +
            'Use `/link <steam_id>` to link your Steam account first.'
          )
          .setFooter({ text: 'Need help? Use /help to see all available commands.' });

        await interaction.reply({ embeds: [notLinkedEmbed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Delete the user record
      await database.deleteUser(discordId);

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Green
        .setTitle('✅ Account Unlinked')
        .setDescription(
          'Successfully removed the link between your Discord and Steam accounts.\n\n' +
          'Your previous statistics and preferences have been cleared.'
        )
        .addFields({
          name: 'ℹ️ What this means:',
          value: '• You\'ll need to specify Steam ID in stat commands\n' +
                 '• Your cached data has been removed\n' +
                 '• You can link a different Steam account anytime',
          inline: false
        })
        .setFooter({ text: 'Use /link <steam_id> to link an account again.' });

      await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
      logger.info(`User ${interaction.user.tag} unlinked Steam account`, {
        discordId,
        previousSteam64: existingUser.steam_id
      });

    } catch (error) {
      logger.error('Error in unlink command:', {
        error: error instanceof Error ? error.message : error,
        discordId,
        stack: error instanceof Error ? error.stack : undefined
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Red
        .setTitle('❌ Error')
        .setDescription('An error occurred while unlinking your account. Please try again later.')
        .setFooter({ text: 'If the problem persists, please contact support.' });

      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

export default command;