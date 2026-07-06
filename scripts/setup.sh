#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║   WorkManager — Development Setup            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ─── 1. Check prerequisites ──────────────────────────────────
echo "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { error "Docker is required. Install from https://docs.docker.com/get-docker/"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { error "pnpm is required. Install via: npm install -g pnpm"; exit 1; }
info "Docker found"
info "pnpm found"

# ─── 2. Setup .env ───────────────────────────────────────────
if [ ! -f .env ]; then
  echo ""
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  # Generate a random auth secret
  AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/AUTH_SECRET=\"change-me-to-a-random-string\"/AUTH_SECRET=\"$AUTH_SECRET\"/" .env
  else
    sed -i "s/AUTH_SECRET=\"change-me-to-a-random-string\"/AUTH_SECRET=\"$AUTH_SECRET\"/" .env
  fi
  info ".env file created with random AUTH_SECRET"
else
  info ".env file already exists"
fi

# ─── 3. Install dependencies ─────────────────────────────────
echo ""
echo "Installing dependencies..."
pnpm install
info "Dependencies installed"

# ─── 4. Start Docker services ────────────────────────────────
echo ""
echo "Starting Docker services..."
if docker compose ps 2>/dev/null | grep -q "Up"; then
  info "Docker services already running"
else
  docker compose up -d
  info "Docker services started (Postgres, Redis, MinIO, Meilisearch, Mailpit)"
fi

# ─── 5. Wait for Postgres ────────────────────────────────────
echo ""
echo "Waiting for Postgres to be ready..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U dev -d workmanagement >/dev/null 2>&1; then
    info "Postgres is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Postgres failed to start"
    exit 1
  fi
  sleep 1
done

# ─── 6. Push schema ──────────────────────────────────────────
echo ""
echo "Pushing database schema..."
pnpm db:push
info "Database schema pushed"

# ─── 7. Seed database ────────────────────────────────────────
echo ""
echo "Seeding database..."
pnpm db:seed
info "Database seeded"

# ─── 8. Done ─────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Setup Complete!                            ║"
echo "║                                              ║"
echo "║   Run:  pnpm dev                             ║"
echo "║   Open: http://localhost:3000                ║"
echo "║                                              ║"
echo "║   Default admin: run db:seed to create       ║"
echo "║   Default seed org: 'default'                ║"
echo "╚══════════════════════════════════════════════╝"
