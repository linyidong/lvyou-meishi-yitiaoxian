#!/usr/bin/env bash
# 家机：每日 pg_dump + 传到云机（异地容灾）
# cron: 0 4 * * * /path/to/backup-db.sh >> /var/log/lyytx-backup.log 2>&1
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-supabase-db}"
OUT_DIR="${OUT_DIR:-$HOME/backups/lyytx}"
REMOTE="${REMOTE:-root@139.199.191.102:/root/backups/lyytx/}"
KEEP_LOCAL=7
KEEP_REMOTE=30

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d)"
FILE="$OUT_DIR/lyytx-$STAMP.sql"

docker exec -t "$PG_CONTAINER" pg_dump -U postgres -d postgres --no-owner --no-privileges > "$FILE"
gzip -f "$FILE"

# 传到云机（ssh key 认证）
rsync -az "$FILE.gz" "$REMOTE"

# 本地保留最近 N 份
ls -1t "$OUT_DIR"/lyytx-*.sql.gz | tail -n +$((KEEP_LOCAL+1)) | xargs -r rm -f

# 云机保留最近 N 份
ssh "${REMOTE%%:*}" "ls -1t /root/backups/lyytx/lyytx-*.sql.gz | tail -n +$((KEEP_REMOTE+1)) | xargs -r rm -f"

echo "[$(date '+%F %T')] backup ok: $FILE.gz"
