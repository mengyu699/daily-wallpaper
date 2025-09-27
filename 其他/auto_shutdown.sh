#!/bin/bash

# WeWe RSS Auto Shutdown Script
# Purpose: Safely shutdown the server after collection to save costs

set -e

# Configuration
LOG_DIR="/opt/wewe-rss/logs"
LOG_FILE="$LOG_DIR/shutdown_$(date '+%Y%m%d_%H%M%S').log"
SHUTDOWN_DELAY=60  # seconds

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Auto Shutdown Script Started ==="

# Final cleanup - ensure all containers are stopped
log "Performing final cleanup..."
cd /opt/wewe-rss

# Stop any running WeWe RSS containers
if docker-compose ps | grep -q "Up"; then
    log "Stopping remaining WeWe RSS containers..."
    docker-compose down || log "WARNING: Failed to stop containers"
fi

# Clean up Docker resources to free space
log "Cleaning up Docker resources..."
docker system prune -f || log "WARNING: Docker cleanup failed"

# Check disk usage
log "Current disk usage:"
df -h / >> "$LOG_FILE" 2>&1

# Log system uptime and load
log "System status before shutdown:"
uptime >> "$LOG_FILE" 2>&1

# Schedule shutdown
log "Scheduling system shutdown in $SHUTDOWN_DELAY seconds..."
log "This allows time for log writing and graceful service termination."

# Send notification to system log
logger "WeWe RSS collection completed. System shutting down automatically."

# Schedule the shutdown
shutdown -h +1 "WeWe RSS collection completed. Auto-shutdown initiated." || {
    log "ERROR: Failed to schedule shutdown. Manual intervention required."
    exit 1
}

log "Shutdown scheduled successfully. System will halt in 1 minute."
log "To cancel shutdown, run: sudo shutdown -c"
log "=== Auto Shutdown Script Completed ==="

# Give a final warning
sleep 10
log "WARNING: System will shutdown in 50 seconds!"
sleep 30
log "WARNING: System will shutdown in 20 seconds!"