#!/usr/bin/env bash
#
# Prove a WorkManager backup restores — the last gate before real users.
#
# Spins a throwaway Postgres container, restores the dump into it (decrypting
# first if needed), prints row counts so you can eyeball that real data came
# back, then tears the container down. Touches nothing else.
#
# Usage:
#   BACKUP_FILE=backups/wm-2026-08-21_120000.sql.gz.enc \
#   BACKUP_PASSPHRASE='...' \
#     ./scripts/verify-restore.sh
#
# Env:
#   BACKUP_FILE        (required)  a .sql.gz or .sql.gz.enc produced by backup-db.sh
#   BACKUP_PASSPHRASE  (required for .enc)  the passphrase used to encrypt it
#   PG_IMAGE           (default postgres:17-alpine)  match your prod Postgres major
#   SCRATCH_PORT       (default 55433)  host port for the throwaway container
set -euo pipefail

: "${BACKUP_FILE:?set BACKUP_FILE to a .sql.gz or .sql.gz.enc backup}"
[ -f "$BACKUP_FILE" ] || { echo "[restore] no such file: $BACKUP_FILE" >&2; exit 1; }
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
PORT="${SCRATCH_PORT:-55433}"
name="wm-restore-test-$$"
tmp="$(mktemp)"

cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -f "$tmp" 2>/dev/null || true; }
trap cleanup EXIT

echo "[restore] starting throwaway $PG_IMAGE on :$PORT"
docker run -d --name "$name" \
  -e POSTGRES_DB=workmanager -e POSTGRES_USER=wmuser -e POSTGRES_PASSWORD=wmtest \
  -p "$PORT:5432" "$PG_IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$name" pg_isready -U wmuser -d workmanager >/dev/null 2>&1 && break
  sleep 1
done

if [[ "$BACKUP_FILE" == *.enc ]]; then
  : "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE to decrypt $BACKUP_FILE}"
  echo "[restore] decrypting + decompressing…"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "$BACKUP_FILE" -pass env:BACKUP_PASSPHRASE | gunzip > "$tmp"
else
  echo "[restore] decompressing…"
  gunzip -c "$BACKUP_FILE" > "$tmp"
fi

echo "[restore] restoring into the throwaway DB…"
PGPASSWORD=wmtest psql -v ON_ERROR_STOP=1 -q \
  -h localhost -p "$PORT" -U wmuser -d workmanager -f "$tmp" >/dev/null

echo "[restore] row counts in the restored copy:"
PGPASSWORD=wmtest psql -h localhost -p "$PORT" -U wmuser -d workmanager -At -c \
  "select 'organizations='||count(*) from organizations
   union all select 'users='||count(*) from users
   union all select 'tasks='||count(*) from tasks;" | sed 's/^/[restore]   /'

echo "[restore] ✓ backup restores cleanly — tearing down the throwaway DB"
