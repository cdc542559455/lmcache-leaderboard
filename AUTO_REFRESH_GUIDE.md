# Auto-Refresh Guide

## Overview

The LMCache Leaderboard now includes an **embedded auto-refresh system** that automatically pulls the latest data from the official LMCache repository and regenerates the leaderboard **every 15 minutes**, as long as the API server is running.

## How It Works

### 1. Embedded Cron Job (Inside API Server)

The auto-refresh functionality is built directly into the API server (`dashboard/api-server.js`), so **no external cron job setup is needed**.

**Key Features:**
- Runs automatically when the API server starts
- Executes first refresh 30 seconds after server startup
- Continues refreshing every 15 minutes thereafter
- Pulls from official repository: `https://github.com/LMCache/LMCache` (dev branch)
- Regenerates leaderboard data automatically
- Saves timestamp and status to `dashboard/public/last-update.json`

### 2. Live Status Display

The main dashboard displays real-time auto-refresh status in the header:

**What You'll See:**
- **Data generated**: When the leaderboard data was created
- **Auto-refresh**: When the last automatic refresh occurred
- **Live updates indicator**: Green pulsing dot + "Live updates every 15min"

The dashboard polls `last-update.json` every 30 seconds to show the latest status.

## How to Use

### Starting the System

Simply start the API server:

```bash
cd dashboard
npm run api
```

That's it! Auto-refresh will start automatically.

### What Happens

1. **Server starts** → Displays: "🔄 Starting auto-refresh interval (every 15 minutes)"
2. **After 30 seconds** → First refresh runs
3. **Every 15 minutes** → Automatic refresh from official LMCache repo
4. **On each refresh**:
   - Fetches latest commits from `https://github.com/LMCache/LMCache`
   - Force-updates local repository
   - Regenerates leaderboard data
   - Updates `last-update.json` with timestamp and commit info
   - Logs: "✅ [AUTO-REFRESH] Completed successfully at [timestamp]"

### Monitoring

**Check Server Logs:**
```bash
# You'll see logs like:
⏰ [AUTO-REFRESH] Starting scheduled refresh from official LMCache repository...
📌 [AUTO-REFRESH] Latest commit: fdadfea... - Commit message (date)
✅ [AUTO-REFRESH] Completed successfully at 2025-10-19T23:27:31.442Z
```

**Check Dashboard:**
- Open the leaderboard in your browser
- Look at the top-right header
- You should see:
  - Data generation time
  - Auto-refresh time
  - Green pulsing dot indicating live updates

**Check Last Update File:**
```bash
cat dashboard/public/last-update.json
```

Expected output:
```json
{
  "timestamp": "2025-10-19T23:27:31.442Z",
  "latestCommit": "fdadfea... - Commit message (date)",
  "success": true,
  "source": "auto-refresh"
}
```

## Manual Refresh (Admin Panel)

You can also trigger a manual refresh anytime via the Admin Panel:

1. Click **"🔑 Admin"** button
2. Click **"🔄 Pull from Official Repo"** button
3. Confirm the operation
4. Wait ~30-60 seconds for completion

This is useful if you want to refresh immediately without waiting for the next 15-minute interval.

## Configuration

### Changing Refresh Interval

Edit `dashboard/api-server.js`:

```javascript
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Change to 5 minutes:
const REFRESH_INTERVAL = 5 * 60 * 1000;

// Change to 1 hour:
const REFRESH_INTERVAL = 60 * 60 * 1000;
```

### Changing Initial Delay

Edit `dashboard/api-server.js`:

```javascript
// Run immediately on startup (after 30 seconds)
setTimeout(() => {
  performAutoRefresh();
}, 30000); // Change this value (in milliseconds)
```

## Troubleshooting

### Auto-refresh not running

**Check if API server is running:**
```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok"}
```

**Check server logs for errors:**
```bash
# Look for error messages in the terminal running npm run api
```

### LMCache repository not found

If you see: "📥 [AUTO-REFRESH] LMCache repo not found, skipping auto-refresh"

**Solution:**
```bash
cd /path/to/lmcache-leaderboard
git clone https://github.com/LMCache/LMCache.git
```

### Dashboard not showing auto-refresh time

**Ensure `last-update.json` exists:**
```bash
ls dashboard/public/last-update.json
```

**Force a manual refresh:**
- Use the Admin Panel to trigger a manual refresh
- This will create the file if it doesn't exist

## Architecture

```
┌─────────────────────────────────────────┐
│  API Server (api-server.js)            │
│                                         │
│  ┌────────────────────────────────┐   │
│  │  Auto-Refresh Interval         │   │
│  │  - Runs every 15 minutes       │   │
│  │  - Pulls from official repo    │   │
│  │  - Regenerates leaderboard     │   │
│  │  - Updates last-update.json    │   │
│  └────────────────────────────────┘   │
│                                         │
│  ┌────────────────────────────────┐   │
│  │  Manual Refresh API            │   │
│  │  POST /api/pull-and-refresh    │   │
│  └────────────────────────────────┘   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Dashboard (App.jsx)                    │
│                                         │
│  - Polls last-update.json every 30s    │
│  - Displays auto-refresh status        │
│  - Shows live indicator                │
└─────────────────────────────────────────┘
```

## Benefits

1. **No External Dependencies**: No need to set up system cron jobs
2. **Cross-Platform**: Works on macOS, Linux, and Windows
3. **Automatic**: Starts automatically when API server starts
4. **Visible**: Live status indicator on dashboard
5. **Reliable**: Built into the application lifecycle
6. **Flexible**: Easy to configure interval and behavior

## Production Deployment

For production, ensure the API server runs continuously:

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start API server with PM2
cd dashboard
pm2 start npm --name "lmcache-api" -- run api

# Ensure it starts on system reboot
pm2 startup
pm2 save
```

### Using systemd (Linux)

Create `/etc/systemd/system/lmcache-api.service`:

```ini
[Unit]
Description=LMCache Leaderboard API Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/lmcache-leaderboard/dashboard
ExecStart=/usr/bin/npm run api
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable lmcache-api
sudo systemctl start lmcache-api
```

## Summary

The embedded auto-refresh system ensures your leaderboard stays up-to-date with the official LMCache repository automatically, without any manual intervention or complex cron job setup. Just start the API server, and it handles everything!
