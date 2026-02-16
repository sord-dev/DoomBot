import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { database } from './database/database';
import { commandHandler } from './handlers/commandHandler';
import { matchMonitor } from './services/matchMonitor';
import path from 'path';

// Load environment variables
config();

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Bot startup
client.once(Events.ClientReady, async () => {
  logger.info(`Bot logged in as ${client.user?.tag}`);
  
  // Set bot status
  client.user?.setActivity('CS2 Stats | /help', { 
    type: ActivityType.Watching 
  });
  
  // Initialize and start match monitoring service
  matchMonitor.initialize(client);
  matchMonitor.start();
  
  logger.info(`Bot is ready and serving ${client.guilds.cache.size} servers`);
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  
  try {
    await commandHandler.handleCommand(interaction);
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`Command ${interaction.commandName} failed:`, {
      error: errorMessage,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Reply with error message if possible
    const errorReply = {
      content: '❌ An error occurred while executing this command. Please try again later.',
      ephemeral: true
    };
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    } catch (replyError) {
      logger.error('Failed to send error reply:', replyError);
    }
  } finally {
    // Log command usage
    const executionTime = Date.now() - startTime;
    try {
      await database.logCommand({
        command_name: interaction.commandName,
        user_id: interaction.user.id,
        guild_id: interaction.guildId || undefined,
        execution_time_ms: executionTime,
        success,
        error_message: errorMessage
      });
    } catch (dbError) {
      logger.error('Failed to log command usage:', dbError);
    }
  }
});

// Handle bot errors
client.on(Events.Error, (error) => {
  logger.error('Discord client error:', error);
});

client.on(Events.Warn, (warning) => {
  logger.warn('Discord client warning:', warning);
});

// Handle process termination gracefully
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop match monitoring service
    matchMonitor.stop();
    
    // Close database connection
    await database.close();
    
    // Destroy Discord client
    client.destroy();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Main application startup
async function startBot(): Promise<void> {
  try {
    logger.info('Starting doombot...');
    
    // Initialize database
    await database.initialize();
    
    // Clean expired cache on startup
    await database.clearExpiredCache();
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
startBot();