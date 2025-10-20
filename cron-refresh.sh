#!/bin/bash

# Cron job script to auto-refresh leaderboard data from official LMCache repository
# This script runs every 15 minutes to pull latest commits and regenerate the leaderboard

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/cron-refresh.log"
API_URL="http://localhost:3001/api/pull-and-refresh"
MAX_LOG_LINES=1000

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to trim log file to prevent it from growing too large
trim_log() {
    if [ -f "$LOG_FILE" ]; then
        local line_count=$(wc -l < "$LOG_FILE")
        if [ "$line_count" -gt "$MAX_LOG_LINES" ]; then
            log "Trimming log file (current: $line_count lines, max: $MAX_LOG_LINES)"
            tail -n "$MAX_LOG_LINES" "$LOG_FILE" > "$LOG_FILE.tmp"
            mv "$LOG_FILE.tmp" "$LOG_FILE"
        fi
    fi
}

# Start
log "========================================"
log "Starting auto-refresh from official LMCache repository"

# Check if API server is running
if ! curl -s "$API_URL" > /dev/null 2>&1; then
    if ! curl -s "http://localhost:3001/api/health" > /dev/null 2>&1; then
        log "ERROR: API server is not running on port 3001"
        log "Please start the API server with: cd $SCRIPT_DIR/dashboard && npm run api"
        exit 1
    fi
fi

# Call the pull-and-refresh API
log "Calling API: $API_URL"
RESPONSE=$(curl -s -X POST "$API_URL" -H "Content-Type: application/json" 2>&1)

# Check if the request was successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    # Extract latest commit info
    LATEST_COMMIT=$(echo "$RESPONSE" | grep -o '"latestCommit":"[^"]*"' | cut -d'"' -f4)
    TIMESTAMP=$(echo "$RESPONSE" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)

    log "✅ SUCCESS: Refreshed from official LMCache repository"
    log "   Latest commit: $LATEST_COMMIT"
    log "   Timestamp: $TIMESTAMP"

    # Save the last update info for the dashboard to display
    cat > "$SCRIPT_DIR/dashboard/public/last-update.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "latestCommit": "$LATEST_COMMIT",
  "success": true
}
EOF

else
    ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    log "❌ ERROR: Failed to refresh"
    log "   Error: $ERROR_MSG"
    log "   Full response: $RESPONSE"

    # Save error info
    cat > "$SCRIPT_DIR/dashboard/public/last-update.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "error": "$ERROR_MSG",
  "success": false
}
EOF

    exit 1
fi

# Trim log file
trim_log

log "Auto-refresh completed successfully"
log "========================================"
