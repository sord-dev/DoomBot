import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { database } from '../database/database';
import { logger } from '../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('watch')
    .setDescription('Watch for your CS2 match results in this channel')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start watching for match notifications in this channel')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop watching for match notifications in this channel')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check your current watch status')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand(false) || 'start';

    switch (subcommand) {
      case 'start':
        await handleStart(interaction);
        break;
      case 'stop':
        await handleStop(interaction);
        break;
      case 'status':
        await handleStatus(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          flags: MessageFlags.Ephemeral
        });
    }
  }
};

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordId = interaction.user.id;
  const channelId = interaction.channelId;
  const guildId = interaction.guildId!;

  // Check if user has linked Steam account
  const user = await database.getUserByDiscordId(discordId);
  if (!user) {
    await interaction.reply({
      content: '❌ You need to link your Steam account first. Use `/link <steam_id>` to get started.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // Check if channel is a text channel
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: '❌ This command can only be used in text channels.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    // Add or update watch
    await database.setUserWatch(discordId, channelId, guildId, user.steam_id);
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Watch Started')
      .setDescription(
        `You're now watching for CS2 match notifications in ${channel}.\n\n` +
        `**What happens next:**\n` +
        `• I'll check for new matches every 15 minutes\n` +
        `• When a new match is detected, I'll post the stats here\n` +
        `• Each notification includes a link to detailed Leetify analysis\n\n` +
        `Use \`/watch stop\` to stop notifications in this channel.`
      )
      .addFields({
        name: '🔗 Linked Account',
        value: `Steam ID: \`${user.steam_id}\``,
        inline: true
      })
      .setFooter({ 
        text: 'Match monitoring will begin within 15 minutes',
        iconURL: interaction.client.user?.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    
    logger.info('User started watching matches', {
      discordId,
      channelId,
      guildId,
      steamId: user.steam_id
    });

  } catch (error) {
    logger.error('Error setting up watch:', error);
    await interaction.reply({
      content: '❌ An error occurred while setting up match watching. Please try again.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordId = interaction.user.id;
  const channelId = interaction.channelId;

  try {
    const existingWatch = await database.getUserWatch(discordId, channelId);
    
    if (!existingWatch) {
      await interaction.reply({
        content: '❌ You\'re not currently watching for matches in this channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await database.removeUserWatch(discordId, channelId);
    
    const embed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setTitle('⏹️ Watch Stopped')
      .setDescription('You\'re no longer watching for match notifications in this channel.')
      .setFooter({ 
        text: 'You can start watching again anytime with /watch start',
        iconURL: interaction.client.user?.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    
    logger.info('User stopped watching matches', {
      discordId,
      channelId
    });

  } catch (error) {
    logger.error('Error stopping watch:', error);
    await interaction.reply({
      content: '❌ An error occurred while stopping match watching. Please try again.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    const watches = await database.getUserWatches(discordId, guildId);
    const user = await database.getUserByDiscordId(discordId);
    
    if (!user) {
      await interaction.reply({
        content: '❌ You need to link your Steam account first. Use `/link <steam_id>` to get started.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 Watch Status')
      .addFields({
        name: '🔗 Linked Account',
        value: `Steam ID: \`${user.steam_id}\``,
        inline: true
      });

    if (watches.length === 0) {
      embed.setDescription('You\'re not currently watching for matches in any channels.');
      embed.addFields({
        name: '💡 Getting Started',
        value: 'Use `/watch start` in any channel to begin receiving match notifications there.',
        inline: false
      });
    } else {
      const channelList = watches.map(watch => `<#${watch.channel_id}>`).join('\n');
      embed.setDescription(`You're watching for match notifications in **${watches.length}** channel${watches.length > 1 ? 's' : ''}:`);
      embed.addFields({
        name: '📺 Active Channels',
        value: channelList,
        inline: false
      });
    }

    embed.setFooter({ 
      text: 'Match monitoring checks every 15 minutes',
      iconURL: interaction.client.user?.displayAvatarURL() 
    })
    .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

  } catch (error) {
    logger.error('Error getting watch status:', error);
    await interaction.reply({
      content: '❌ An error occurred while checking your watch status. Please try again.',
      flags: MessageFlags.Ephemeral
    });
  }
}

export default command;