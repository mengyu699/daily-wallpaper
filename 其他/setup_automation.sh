#!/bin/bash

# WeWe RSS Automation Setup Script
# Run this script on your Alibaba Cloud server

set -e

echo "=== WeWe RSS Automation Setup ==="
echo "This script will set up daily collection automation"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

# Configuration
WEWE_RSS_DIR="/opt/wewe-rss"
SCRIPTS_DIR="$WEWE_RSS_DIR"
LOG_DIR="$WEWE_RSS_DIR/logs"

# Create directories
echo "Creating required directories..."
mkdir -p "$WEWE_RSS_DIR"
mkdir -p "$LOG_DIR"

# Set proper ownership (assuming wewe-rss user exists, adjust as needed)
# If you have a specific user for wewe-rss, uncomment and modify:
# chown -R wewe-rss:wewe-rss "$WEWE_RSS_DIR"

echo "Setting up cron job for daily execution at 12:00..."

# Create cron job entry
CRON_ENTRY="0 12 * * * root /opt/wewe-rss/daily_collection.sh >> /opt/wewe-rss/logs/cron.log 2>&1"

# Check if cron job already exists
if ! crontab -l 2>/dev/null | grep -q "daily_collection.sh"; then
    # Add to system crontab
    echo "$CRON_ENTRY" >> /etc/crontab
    echo "Cron job added to /etc/crontab"
else
    echo "Cron job already exists"
fi

# Make scripts executable
echo "Setting script permissions..."
chmod +x "$SCRIPTS_DIR/daily_collection.sh"
chmod +x "$SCRIPTS_DIR/auto_shutdown.sh"

# Restart cron service to ensure changes take effect
echo "Restarting cron service..."
systemctl restart cron || systemctl restart crond

echo "=== Setup completed successfully! ==="
echo ""
echo "Summary:"
echo "- Daily collection script: $SCRIPTS_DIR/daily_collection.sh"
echo "- Auto shutdown script: $SCRIPTS_DIR/auto_shutdown.sh"
echo "- Cron job: Daily at 12:00 PM"
echo "- Logs directory: $LOG_DIR"
echo ""
echo "To test the setup:"
echo "  sudo $SCRIPTS_DIR/daily_collection.sh"
echo ""
echo "To view cron jobs:"
echo "  crontab -l"
echo ""
echo "To cancel a scheduled shutdown:"
echo "  sudo shutdown -c"