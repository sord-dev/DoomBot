import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { commandHandler } from './handlers/commandHandler';
import { logger } from './utils/logger';

// Load environment variables
config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  logger.error('Missing required environment variables: DISCORD_TOKEN and/or DISCORD_CLIENT_ID');
  process.exit(1);
}

const clientId = DISCORD_CLIENT_ID as string;
const guildId = DISCORD_GUILD_ID as string | undefined;

const rest = new REST().setToken(DISCORD_TOKEN);

async function deployCommands(): Promise<void> {
  try {
    // Get all commands data - this will load commands first
    const commands = await commandHandler.getCommandsData();
    
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // Deploy commands
    if (guildId) {
      // Guild-specific deployment (faster for development)
      logger.info(`Deploying commands to guild: ${guildId}`);
      
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
    } else {
      // Global deployment (takes up to 1 hour to propagate)
      logger.info('Deploying commands globally...');
      
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
    }

    logger.info(`Successfully reloaded ${commands.length} application (/) commands.`);

    // Print command names for verification
    const commandNames = commands.map(cmd => cmd.name);
    logger.info(`Deployed commands: ${commandNames.join(', ')}`);

  } catch (error) {
    logger.error('Error deploying commands:', error);
    process.exit(1);
  }
}

// Run deployment
deployCommands();