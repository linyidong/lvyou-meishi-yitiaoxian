#!/usr/bin/env bash
# 云机：把最新一份 pg_dump 传到对象存储（腾讯云 COS，S3 兼容）
# 未配置时直接跳过（返回 0），不影响本地备份
set -euo pipefail

CONF="/srv/backup/rclone.conf"
ENVF="/srv/backup/.cos.env"
[ -f "$CONF" ] && [ -f "$ENVF" ] || { echo "COS 未配置，跳过上传"; exit 0; }
set -a; . "$ENVF"; set +a

FILE="${1:?用法: backup-upload-cos.sh <文件>}"
REMOTE="${COS_REMOTE:?COS_REMOTE 未设置}"

rclone --config "$CONF" copy "$FILE" "$REMOTE/" --checksum --retries 3 --low-level-retries 3
echo "[$(date '+%F %T')] cos upload ok: $FILE -> $REMOTE/"
