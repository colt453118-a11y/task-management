#!/bin/bash
# ─── Overdue Task Check Cron Script ────────────────────────
# 
# Set up to run every 30 minutes via system crontab:
#   */30 * * * * /path/to/scripts/cron-check-overdue.sh
#
# Or via cron-job.org/cronhooks pointing to:
#   https://your-domain.com/api/automation/check-overdue#   with Authorization: Bearer your-cron-secret

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────
# Change these for your deployment
BASE_URL="${BASE_URL:?BASE_URL environment variable is required. Example: https://your-domain.com}"
CRON_SECRET="${CRON_SECRET:?CRON_SECRET environment variable is required. Set this to the same value as your .env CRON_SECRET}"

# ─── Execute ───────────────────────────────────────────────
response=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/automation/check-overdue" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  --max-time 30)

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Overdue check: HTTP ${http_code}"

if [ "$http_code" -eq 200 ]; then
  tasks_processed=$(echo "$body" | grep -o '"tasksProcessed":[0-9]*' | cut -d: -f2)
  tasks_skipped=$(echo "$body" | grep -o '"tasksSkippedDuplicates":[0-9]*' | cut -d: -f2)
  errors=$(echo "$body" | grep -o '"errors":\[{"' | wc -l)
  echo "  Processed: ${tasks_processed:-0}, Skipped: ${tasks_skipped:-0}, Errors: ${errors:-0}"
  exit 0
else
  echo "  Error: $(echo "$body" | head -c 200)"
  exit 1
fi
