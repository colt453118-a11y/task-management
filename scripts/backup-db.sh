#!/usr/bin/env bash
#
# Off-box Postgres backup for WorkManager.
#
# The free-tier managed Postgres has no automated backups and auto-deletes after
# 90 days, so the database survives only if it's exported. This runs a compressed
# pg_dump and, when a passphrase is provided, encrypts it (AES-256) so the dump —
# which contains user PII — is safe to copy to a cloud drive / object storage.
#
# Usage:
#   PROD_DB_URL='postgres://user:pass@host:5432/db' \
#   BACKUP_PASSPHRASE='...' \
#     ./scripts/backup-db.sh
#
# Env:
#   PROD_DB_URL        (required)  connection string to dump
#   BACKUP_DIR         (default ./backups)  where the file is written
#   BACKUP_PASSPHRASE  (recommended)  AES-256 passphrase. Keep it in your password
#                      manager, NOT on the server. Without it the dump is left
#                      unencrypted and must not be copied off-box as-is.
#
# Prove a backup actually restores with scripts/verify-restore.sh — an untested
# backup is not a backup.
set -euo pipefail

: "${PROD_DB_URL:?set PROD_DB_URL to the Postgres connection string}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y-%m-%d_%H%M%S)"
base="$BACKUP_DIR/wm-$stamp.sql.gz"

echo "[backup] dumping database → $base"
# --no-owner/--no-privileges so the dump restores cleanly under any role.
pg_dump --no-owner --no-privileges "$PROD_DB_URL" | gzip -9 > "$base"
size="$(du -h "$base" | cut -f1)"

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  enc="$base.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -in "$base" -out "$enc" -pass env:BACKUP_PASSPHRASE
  rm -f "$base"
  echo "[backup] ✓ encrypted backup ready (${size} compressed): $enc"
  echo "[backup]   → copy this file off-box; keep BACKUP_PASSPHRASE out of the server."
else
  echo "[backup] ✓ backup ready (${size}): $base"
  echo "[backup]   WARNING: unencrypted. Set BACKUP_PASSPHRASE before copying a PII dump off-box."
fi
