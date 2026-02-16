import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger';

// Load environment variables
config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  logger.error('Missing required environment variables');
  process.exit(1);
}

const clientId = DISCORD_CLIENT_ID as string;
const guildId = DISCORD_GUILD_ID as string | undefined;

const rest = new REST().setToken(DISCORD_TOKEN);

async function clearCommands(): Promise<void> {
  try {
    logger.info('Clearing all application commands...');

    // Clear guild commands if guild ID is provided
    if (guildId) {
      logger.info(`Clearing guild commands for guild: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [] }
      );
      logger.info('Guild commands cleared.');
    }

    // Clear global commands
    logger.info('Clearing global commands...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: [] }
    );
    logger.info('Global commands cleared.');

  } catch (error) {
    logger.error('Error clearing commands:', error);
    process.exit(1);
  }
}

// Run clear
clearCommands();