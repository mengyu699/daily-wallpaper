#!/bin/bash

# WeWe RSS Daily Collection Script (Direct Installation Version)
# Created: $(date '+%Y-%m-%d')
# Purpose: Automatically collect articles and shutdown server to save costs

set -e  # Exit on any error

# Configuration
LOG_DIR="/opt/wewe-rss/logs"
LOG_FILE="$LOG_DIR/daily_collection_$(date '+%Y%m%d').log"
WEWE_RSS_DIR="/opt/wewe-rss"
COLLECTION_DAYS=3

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    log "ERROR: $1"
    log "Collection script failed. Server will NOT shutdown automatically."
    exit 1
}

# Start logging
log "=== WeWe RSS Daily Collection Started ==="
log "Collection target: Last $COLLECTION_DAYS days"

# Check if WeWe RSS directory exists
if [ ! -d "$WEWE_RSS_DIR" ]; then
    handle_error "WeWe RSS directory not found: $WEWE_RSS_DIR"
fi

# Change to WeWe RSS directory
cd "$WEWE_RSS_DIR"
log "Changed to directory: $(pwd)"

# Check if server directory exists
if [ ! -d "$SERVER_DIR" ]; then
    handle_error "WeWe RSS server directory not found: $SERVER_DIR"
fi

# Check MySQL service status
log "Checking MySQL service status..."
if ! systemctl is-active --quiet mysql; then
    log "Starting MySQL service..."
    systemctl start mysql || handle_error "Failed to start MySQL service"
    sleep 5
fi
log "MySQL service is running"

# Check if WeWe RSS server is running
log "Checking WeWe RSS server status..."
if pgrep -f "node.*dist/main.js" > /dev/null; then
    log "WeWe RSS server is already running"
else
    log "Starting WeWe RSS server..."
    cd "$SERVER_DIR"
    nohup pnpm start > /dev/null 2>&1 &
    sleep 10
    cd "$WEWE_RSS_DIR"
fi

# Verify server is running
log "Verifying server status..."
if ! pgrep -f "node.*dist/main.js" > /dev/null; then
    handle_error "WeWe RSS server failed to start properly"
fi
log "WeWe RSS server is running successfully"

# Wait for server to be fully ready
log "Waiting 20 seconds for server to initialize..."
sleep 20

# Execute collection using Python client script
log "Starting article collection for the last $COLLECTION_DAYS days..."

# Execute collection command using the Python script
log "Executing collection command..."
if python3 main.py collect --days $COLLECTION_DAYS >> "$LOG_FILE" 2>&1; then
    log "Article collection completed successfully"
else
    handle_error "Article collection failed"
fi

# Generate basic statistics
log "Generating collection statistics..."
if python3 main.py check >> "$LOG_FILE" 2>&1; then
    log "System check completed"
else
    log "WARNING: System check encountered issues (non-critical)"
fi

# Stop WeWe RSS server to save resources
log "Stopping WeWe RSS server..."
pkill -f "node.*dist/main.js" || log "WARNING: Failed to stop server gracefully"

log "=== WeWe RSS Daily Collection Completed Successfully ==="

# Call auto-shutdown script
if [ -f "/opt/wewe-rss/auto_shutdown.sh" ]; then
    log "Executing auto-shutdown script..."
    /opt/wewe-rss/auto_shutdown.sh
else
    log "Auto-shutdown script not found. Server will remain running."
fi

log "=== Script execution finished ==="