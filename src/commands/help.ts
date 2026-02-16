import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../handlers/commandHandler';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information and available commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('general')
        .setDescription('General bot help and commands')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Explain the DoomSquad grading system')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand(false);
    
    if (subcommand === 'stats') {
      const statsEmbed = new EmbedBuilder()
        .setColor(0xFF6600)
        .setTitle('🎖️ DoomSquad Grading System')
        .setDescription('How your **DoomSquad Grade** is calculated:')
        .addFields(
          {
            name: '**Scoring Factors**',
            value: 
              '• **Win Rate (25%)** - Most important: actually winning games\n' +
              '• **Leetify Rating (25%)** - Overall skill assessment\n' +
              '• **K/D Ratio (20%)** - Core fragging performance\n' +
              '• **ADR (15%)** - Damage impact per round\n' +
              '• **Entry Fragging (5%)** - Opening duel success\n' +
              '• **Clutch Rate (5%)** - Pressure situation performance\n' +
              '• **Headshot % (5%)** - Aim precision indicator',
            inline: false
          },
          {
            name: '**Grade Thresholds**',
            value:
              '🔥 **S (Exceptional)** - Top 5% performance\n' +
              '⭐ **A (Excellent)** - Top 15% performance\n' +
              '✨ **B (Above Average)** - Top 35% performance\n' +
              '👍 **C (Average)** - Solid 50th percentile\n' +
              '👎 **D (Below Average)** - Bottom 35%\n' +
              '💀 **F (Poor)** - Bottom 15%',
            inline: false
          },
          {
            name: '**Analysis Period**',
            value: 'Grades are calculated from your **last 30 competitive matches** to reflect current form, not lifetime stats.',
            inline: false
          }
        )
        .setFooter({ 
          text: 'DoomSquad • Realistic CS2 Performance Analysis', 
          iconURL: interaction.client.user?.displayAvatarURL() 
        })
        .setTimestamp();
        
      await interaction.reply({ embeds: [statsEmbed] });
      return;
    }
    
    // Default to general help
    const embed = new EmbedBuilder()
      .setColor(0xFF6600) // Orange color
      .setTitle('🤖 Doombot - CS2 Stats Bot')
      .setDescription('Get detailed Counter-Strike 2 statistics with beautiful presentations!')
      .addFields(
        {
          name: '🔗 **Setup Commands**',
          value: '`/link <steam_id>` - Link your Steam account\n' +
                 '`/unlink` - Remove your linked Steam account',
          inline: false
        },
        {
          name: '📊 **Stats Commands**',
          value: '`/stats [player]` - Show comprehensive player statistics with **DoomSquad Grade**\n' +
                 '`/recent [player]` - Show recent match performance\n' +

                 '`/help stats` - Learn about the DoomSquad grading system',
          inline: false
        },
        {
          name: '💡 **Tips**',
          value: '• Link your Steam account once to use commands without specifying Steam ID\n' +
                 '• Steam ID can be: Steam64, Steam32, SteamID, or profile URL\n' +
                 '• All statistics are powered by Leetify API',
          inline: false
        },
        {
          name: '🎯 **Features**',
          value: '✅ Rich statistical embeds with custom grading\n' +
                 '✅ Performance analysis and insights\n' +
                 '✅ Match history and detailed breakdowns\n' +
                 '✅ Player comparisons and benchmarking',
          inline: false
        }
      )
      .setFooter({ 
        text: 'Doombot • Powered by Leetify API', 
        iconURL: interaction.client.user?.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;