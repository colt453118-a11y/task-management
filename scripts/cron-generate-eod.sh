#!/bin/bash
# ─── EOD Snapshot Generation Cron Script ─────────────────────
#
# Set up to run daily at end of day (e.g., 5 PM) via system crontab:
#   0 17 * * * /path/to/scripts/cron-generate-eod.sh
#
# Or via cron-job.org / cronhooks pointing to:
#   POST https://your-domain.com/api/cron/generate-eod-snapshot
#   Authorization: Bearer your-cron-secret
#
# This endpoint generates an EOD report snapshot for every active
# organization, including an AI-powered summary of the day's activity.
#
# Prerequisites:
#   - BASE_URL environment variable set to your deployment URL
#   - CRON_SECRET environment variable set to match your .env

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────
BASE_URL="${BASE_URL:?BASE_URL environment variable is required. Example: https://your-domain.com}"
CRON_SECRET="${CRON_SECRET:?CRON_SECRET environment variable is required. Set this to the same value as your .env CRON_SECRET}"

# ─── Execute ───────────────────────────────────────────────
response=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/cron/generate-eod-snapshot" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  --max-time 120)

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] EOD snapshot generation: HTTP ${http_code}"

if [ "$http_code" -eq 200 ]; then
  processed=$(echo "$body" | grep -o '"processed":[0-9]*' | cut -d: -f2)
  errors=$(echo "$body" | grep -o '"errors":[0-9]*' | cut -d: -f2)
  total_orgs=$(echo "$body" | grep -o '"totalOrgs":[0-9]*' | cut -d: -f2)
  echo "  Orgs: ${total_orgs:-0}, Processed: ${processed:-0}, Errors: ${errors:-0}"
  exit 0
else
  echo "  Error: $(echo "$body" | head -c 200)"
  exit 1
fi
