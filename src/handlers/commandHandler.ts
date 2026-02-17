import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface Command {
  data: any; // SlashCommandBuilder with various configurations
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface CommandModule {
  default: Command;
}

class CommandHandler {
  private commands = new Map<string, Command>();
  private loaded = false;

  constructor() {
    // Don't load commands in constructor - do it explicitly
  }

  async loadCommands(): Promise<void> {
    if (this.loaded) return;
    
    const commandModules = [
      () => import('../commands/help'),
      () => import('../commands/link'),
      () => import('../commands/unlink'),
      () => import('../commands/stats'),
      () => import('../commands/recent'),
      () => import('../commands/watch'),
      () => import('../commands/improve')
    ];

    for (const loadModule of commandModules) {
      try {
        const module = await loadModule() as CommandModule;
        const command = module.default;
        this.commands.set(command.data.name, command);
      } catch (error) {
        console.error(`Failed to load command module:`, error);
      }
    }
    
    this.loaded = true;
  }

  async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await this.loadCommands(); // Ensure commands are loaded
    
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      await interaction.reply({
        content: '❌ Command not found.',
        ephemeral: true
      });
      return;
    }

    await command.execute(interaction);
  }

  async getCommands(): Promise<Command[]> {
    await this.loadCommands(); // Ensure commands are loaded
    return Array.from(this.commands.values());
  }

  async getCommandsData() {
    await this.loadCommands(); // Ensure commands are loaded
    return (await this.getCommands()).map(command => command.data.toJSON());
  }
}

export const commandHandler = new CommandHandler();
export default commandHandler;