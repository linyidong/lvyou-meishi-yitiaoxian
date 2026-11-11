#!/usr/bin/env bash
# 云机：把一份 pg_dump 传到 COS（腾讯云官方 coscmd；rclone 1.53 对 COS 有兼容问题）
set -euo pipefail
ENVF="/srv/backup/.cos.env"
[ -f "$ENVF" ] || { echo "COS 未配置，跳过上传"; exit 0; }
FILE="${1:?用法: backup-upload-cos.sh <文件>}"
export PATH="$HOME/.local/bin:$PATH"

eval "$(python3 - "$ENVF" <<'PY'
import sys, pathlib, shlex
d = {}
for line in pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig", errors="replace").replace("\r", "").split("\n"):
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        d[k.strip()] = v.strip().strip('"').strip("'")
remote = d.get("COS_REMOTE", "")
# cos:bucket/prefix
rest = remote.split(":", 1)[1] if ":" in remote else remote
bucket, _, prefix = rest.partition("/")
print(f"export COS_ID={shlex.quote(d.get('COS_ACCESS_KEY_ID',''))}")
print(f"export COS_KEY={shlex.quote(d.get('COS_SECRET_ACCESS_KEY',''))}")
print(f"export COS_REGION={shlex.quote(d.get('COS_REGION',''))}")
print(f"export COS_BUCKET={shlex.quote(bucket)}")
print(f"export COS_PREFIX={shlex.quote(prefix.strip('/'))}")
PY
)"
[ -n "$COS_ID" ] && [ -n "$COS_KEY" ] && [ -n "$COS_BUCKET" ] || { echo "COS 配置不完整"; exit 1; }

coscmd config -a "$COS_ID" -s "$COS_KEY" -b "$COS_BUCKET" -r "$COS_REGION" >/dev/null
chmod 600 "$HOME/.cos.conf"

NAME=$(basename "$FILE")
coscmd upload "$FILE" "/$COS_PREFIX/$NAME" 2>&1 | tail -1
SIZE=$(stat -c %s "$FILE")
REMOTE_LINE=$(coscmd list "/$COS_PREFIX/" 2>/dev/null | grep "$NAME" || true)
if [ -z "$REMOTE_LINE" ]; then echo "[warn] 上传后列表未找到 $NAME"; exit 1; fi
echo "[$(date '+%F %T')] cos upload ok: $NAME ($SIZE bytes) -> $COS_BUCKET/$COS_PREFIX/"
