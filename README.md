# 🤖 DoomBot - CS2 Statistics Discord Bot

A Discord bot that provides comprehensive Counter-Strike 2 statistics with rich embeds and custom grading using the Leetify API.

## ✨ Features

- 🔗 **Steam Account Linking** - Link your Steam account once, use commands everywhere
- 📊 **Rich Statistics** - Beautiful embeds with custom A-F grading system
- 🏆 **Performance Analysis** - Detailed breakdowns with grades and insights
- ⚔️ **Player Comparisons** - Side-by-side stat comparisons
- 📈 **Recent Match History** - Track your recent performance
- 🐳 **Docker Support** - Easy deployment with Docker and Docker Compose
- ⚡ **Caching System** - Fast responses with intelligent caching
- 🔧 **Slash Commands** - Modern Discord interface with autocomplete

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Docker
- Discord Bot Token
- Leetify API Key (optional but recommended for higher rate limits)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd doombot
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your credentials:

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_application_id_here
DISCORD_GUILD_ID=your_test_guild_id_here_optional

# Leetify API Configuration  
LEETIFY_API_KEY=your_leetify_api_key_here
LEETIFY_BASE_URL=https://api.leetify.com

# Database Configuration
DATABASE_PATH=./data/doombot.db

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Run with Docker (Recommended)

```bash
# Build and start the bot
docker-compose up -d

# View logs
docker-compose logs -f doombot

# Stop the bot
docker-compose down
```

### 4. Run with Node.js

```bash
# Install dependencies
npm install

# Deploy commands to Discord
npm run deploy

# Start in development mode
npm run dev

# Or build and start in production
npm run build
npm start
```

## 🔧 Discord Bot Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and create a bot
4. Copy the bot token to your `.env` file
5. Copy the Application ID to your `.env` file

### 2. Bot Permissions

Required bot permissions:
- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History

Invite URL (replace CLIENT_ID):
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands
```

### 3. Deploy Commands

After setting up your environment:

```bash
npm run deploy
```

This registers the slash commands with Discord.

## 🔑 Leetify API Setup

1. Visit [Leetify Developer Portal](https://leetify.com/app/developer)
2. Create an API key (requires Leetify account)
3. Add the API key to your `.env` file

> **Note:** The bot works without an API key but has lower rate limits and may be less reliable.

## 📋 Available Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/help` | Show help information | `/help` |
| `/link` | Link your Steam account | `/link <steam_id>` |
| `/unlink` | Remove linked Steam account | `/unlink` |
| `/stats` | Show comprehensive player stats | `/stats [player]` |
| `/recent` | Show recent match performance | `/recent [player] [matches]` |

### Steam ID Formats

The bot accepts multiple Steam ID formats:
- **Steam64**: `76561198123456789`
- **Steam32**: `123456789`  
- **SteamID**: `STEAM_0:1:61728394`
- **Profile URL**: `https://steamcommunity.com/profiles/76561198123456789`

## 🏗️ Architecture

```
src/
├── commands/          # Discord slash commands
│   ├── help.ts
│   ├── link.ts
│   ├── unlink.ts
│   ├── stats.ts
│   └── recent.ts
├── database/          # SQLite database layer
│   ├── database.ts
│   └── schema.sql
├── handlers/          # Command and event handlers
│   └── commandHandler.ts
├── services/          # External API integrations
│   └── leetify.ts
├── utils/             # Utility functions
│   ├── logger.ts
│   ├── grading.ts
│   └── steam.ts
├── deploy-commands.ts # Command deployment script
└── index.ts          # Main bot entry point
```

## 🐳 Docker Configuration

### Development

```yaml
# docker-compose.yml
version: '3.8'
services:
  doombot:
    build: .
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
```

### Production Deployment

```bash
# Build production image
docker build -t doombot:latest .

# Run with production settings
docker run -d \
  --name doombot \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  doombot:latest
```

## 📊 Grading System

DoomBot uses a comprehensive A-F grading system:

| Grade | Description | Color | Emoji |
|-------|-------------|-------|-------|
| S | Exceptional (Top 5%) | 🔥 Orange | 🔥 |
| A | Excellent (Top 15%) | 🟢 Green | ⭐ |
| B | Good (Top 35%) | 🟢 Light Green | ✨ |
| C | Average (50th percentile) | 🟡 Yellow | 👍 |
| D | Below Average | 🟠 Orange | 👎 |
| F | Poor | 🔴 Red | 💀 |

### Graded Statistics

- K/D Ratio
- Average Damage per Round (ADR)
- Headshot Percentage
- Win Rate
- Rating (Leetify/HLTV style)
- First Kill Rate
- Clutch Success Rate
- Multi-kill Rate
- Utility Damage
- Smoke Success Rate

## 🔒 Security Features

- Non-root Docker user
- Input validation and sanitization
- Rate limiting protection
- Secure environment variable handling
- SQL injection prevention
- Error handling without information leakage

## 📈 Performance & Caching

- Intelligent caching system with configurable TTL
- Database connection pooling
- Efficient Discord embed generation
- Rate limit compliance
- Background cache cleanup
- Health monitoring

## 🐛 Troubleshooting

### Common Issues

**Bot not responding to commands:**
- Ensure bot has proper permissions in the server
- Check that commands are deployed: `npm run deploy`
- Verify `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` are correct

**"Player not found" errors:**
- Verify Steam ID format is correct
- Check if player has CS2 matches on Leetify
- Ensure player profile is not private

**Rate limit errors:**
- Add Leetify API key to `.env` for higher limits
- Wait a few minutes before retrying
- Consider reducing command usage frequency

**Database errors:**
- Ensure `data/` directory has write permissions
- Check disk space availability
- Verify SQLite is properly installed

### Logs

View logs for debugging:

```bash
# Docker
docker-compose logs -f doombot

# Node.js  
tail -f logs/combined.log
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Leetify](https://leetify.com/) for providing the CS2 statistics API
- [Discord.js](https://discord.js.org/) for the Discord API wrapper
- The CS2 community for inspiration and feedback

## 📞 Support

- Create an issue on GitHub for bug reports
- Join our Discord server for community support
- Check the troubleshooting section for common problems

---

**Made with ❤️ for the CS2 community**