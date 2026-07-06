#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting WorkManager development environment..."

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Start Docker services if not running
if ! docker compose ps 2>/dev/null | grep -q "Up"; then
  echo "  → Starting Docker services..."
  docker compose up -d
  echo "  ✓ Postgres, Redis, MinIO, Meilisearch, Mailpit started"
fi

# Ensure .env exists
if [ ! -f .env ]; then
  echo "  → Creating .env from .env.example..."
  cp .env.example .env
  AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/AUTH_SECRET=\"change-me-to-a-random-string\"/AUTH_SECRET=\"$AUTH_SECRET\"/" .env
  else
    sed -i "s/AUTH_SECRET=\"change-me-to-a-random-string\"/AUTH_SECRET=\"$AUTH_SECRET\"/" .env
  fi
  echo "  ✓ .env created"
fi

# Start dev server
echo ""
echo "  Starting Next.js dev server..."
pnpm dev
