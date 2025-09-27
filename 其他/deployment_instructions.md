# WeWe RSS Automation Deployment Instructions

## Files Created

I've created the following automation scripts locally:

1. **daily_collection.sh** - Main collection script
2. **auto_shutdown.sh** - Auto shutdown script  
3. **setup_automation.sh** - Setup script for server
4. **deployment_instructions.md** - This file

## Deployment Steps

### Step 1: Transfer Files to Your Cloud Server

```bash
# Replace YOUR_SERVER_IP with your actual server IP
# Replace YOUR_SSH_KEY with your SSH key path if needed

# Method 1: Using scp
scp daily_collection.sh root@YOUR_SERVER_IP:/opt/wewe-rss/
scp auto_shutdown.sh root@YOUR_SERVER_IP:/opt/wewe-rss/
scp setup_automation.sh root@YOUR_SERVER_IP:/tmp/

# Method 2: Using rsync
rsync -avz daily_collection.sh auto_shutdown.sh setup_automation.sh root@YOUR_SERVER_IP:/tmp/
```

### Step 2: SSH into Your Server

```bash
ssh root@YOUR_SERVER_IP
```

### Step 3: Run Setup Script

```bash
# Move scripts to proper location
sudo mv /tmp/daily_collection.sh /opt/wewe-rss/
sudo mv /tmp/auto_shutdown.sh /opt/wewe-rss/
sudo mv /tmp/setup_automation.sh /opt/wewe-rss/

# Run the setup script
cd /opt/wewe-rss
sudo chmod +x setup_automation.sh
sudo ./setup_automation.sh
```

## Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Create the scripts manually

```bash
# Create directories
sudo mkdir -p /opt/wewe-rss/logs

# Copy the script contents (you'll need to paste the content)
sudo nano /opt/wewe-rss/daily_collection.sh
sudo nano /opt/wewe-rss/auto_shutdown.sh

# Make executable
sudo chmod +x /opt/wewe-rss/daily_collection.sh
sudo chmod +x /opt/wewe-rss/auto_shutdown.sh
```

### 2. Set up cron job

```bash
# Edit system crontab
sudo nano /etc/crontab

# Add this line:
0 12 * * * root /opt/wewe-rss/daily_collection.sh >> /opt/wewe-rss/logs/cron.log 2>&1

# Restart cron service
sudo systemctl restart cron
```

## Testing

### Test the collection script

```bash
# Run manually to test
sudo /opt/wewe-rss/daily_collection.sh
```

### Check logs

```bash
# View collection logs
tail -f /opt/wewe-rss/logs/daily_collection_$(date +%Y%m%d).log

# View cron logs
tail -f /opt/wewe-rss/logs/cron.log
```

### Cancel shutdown (if needed)

```bash
# If the auto-shutdown is triggered and you want to cancel
sudo shutdown -c
```

## Script Features

### Daily Collection Script (`daily_collection.sh`)
- Checks and starts Docker service
- Starts WeWe RSS containers if not running
- Collects articles from the last 3 days
- Generates collection statistics
- Stops containers to save resources
- Calls auto-shutdown script
- Comprehensive logging

### Auto Shutdown Script (`auto_shutdown.sh`)
- Performs final cleanup
- Stops all containers
- Cleans up Docker resources
- Logs system status
- Schedules system shutdown with 1-minute delay
- Provides cancellation instructions

### Cron Configuration
- Runs daily at 12:00 PM (noon)
- Logs output to `/opt/wewe-rss/logs/cron.log`
- Runs as root for system shutdown privileges

## Important Notes

1. **Server Costs**: The auto-shutdown feature will turn off your server to save costs
2. **Manual Start**: You'll need to manually start your server when you want to access the WeWe RSS interface
3. **Logs**: All activities are logged for troubleshooting
4. **Cancellation**: You have 1 minute to cancel the shutdown if needed
5. **Error Handling**: If collection fails, the server will NOT shutdown automatically

## Customization

You can modify the following variables in the scripts:
- `COLLECTION_DAYS=3` - Number of days to collect articles
- `SHUTDOWN_DELAY=60` - Delay before shutdown in seconds
- Cron schedule `0 12 * * *` - Change the time as needed

## Monitoring

To monitor the automation:
- Check logs in `/opt/wewe-rss/logs/`
- Verify cron job: `crontab -l`
- Check system logs: `journalctl -u cron`