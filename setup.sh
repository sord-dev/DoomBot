#!/bin/bash

# doombot-setup.sh - Quick setup script for DoomBot development

set -e

echo "🤖 DoomBot Setup Script"
echo "======================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION is not supported. Please install Node.js 18 or higher."
        exit 1
    fi
    
    print_success "Node.js $(node --version) detected"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    print_success "npm $(npm --version) detected"
}

# Create environment file from template
setup_env() {
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from template"
            print_warning "Please edit .env file with your Discord bot credentials before running the bot"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi
}

# Create necessary directories
create_directories() {
    mkdir -p data
    mkdir -p logs
    print_success "Created data and logs directories"
}

# Install dependencies
install_dependencies() {
    print_status "Installing npm dependencies..."
    npm install
    print_success "Dependencies installed successfully"
}

# Build TypeScript
build_project() {
    print_status "Building TypeScript project..."
    npm run build
    print_success "Project built successfully"
}

# Deploy commands (if environment is configured)
deploy_commands() {
    if [ -f ".env" ]; then
        # Check if required env vars are set (not just placeholder values)
        source .env
        if [ "$DISCORD_TOKEN" != "your_discord_bot_token_here" ] && [ "$DISCORD_CLIENT_ID" != "your_discord_application_id_here" ]; then
            print_status "Deploying Discord commands..."
            npm run deploy
            print_success "Commands deployed to Discord"
        else
            print_warning "Discord credentials not configured. Skipping command deployment."
            print_warning "Please edit .env file and run 'npm run deploy' manually."
        fi
    else
        print_warning ".env file not found. Skipping command deployment."
    fi
}

# Check Docker (optional)
check_docker() {
    if command -v docker &> /dev/null; then
        print_success "Docker detected (optional for containerized deployment)"
        if command -v docker-compose &> /dev/null; then
            print_success "Docker Compose detected"
        else
            print_warning "Docker Compose not found (recommended for easy deployment)"
        fi
    else
        print_warning "Docker not found (optional for containerized deployment)"
    fi
}

# Main setup process
main() {
    echo "Starting doombot setup..."
    echo ""
    
    # Pre-flight checks
    print_status "Checking system requirements..."
    check_nodejs
    check_npm
    check_docker
    echo ""
    
    # Setup process
    print_status "Setting up project..."
    setup_env
    create_directories
    install_dependencies
    build_project
    echo ""
    
    # Post-setup
    print_status "Finalizing setup..."
    deploy_commands
    echo ""
    
    # Final instructions
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file with your Discord bot credentials"
    echo "2. Optionally add your Leetify API key for better performance"
    echo "3. Run the bot:"
    echo "   • Development: npm run dev"
    echo "   • Production: npm start"
    echo "   • Docker: docker-compose up -d"
    echo ""
    echo "For help and documentation, see README.md"
}

# Run main function
main

