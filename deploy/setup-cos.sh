#!/usr/bin/env bash
# 云机一次性配置：从 /srv/backup/.cos.env 生成 rclone 配置并自检
set -euo pipefail
ENVF="/srv/backup/.cos.env"
CONF="/srv/backup/rclone.conf"
[ -f "$ENVF" ] || { echo "缺少 $ENVF"; exit 1; }
set -a; . "$ENVF"; set +a
: "${COS_REMOTE:?COS_REMOTE 未设置}"
: "${COS_ACCESS_KEY_ID:?COS_ACCESS_KEY_ID 未设置}"
: "${COS_SECRET_ACCESS_KEY:?COS_SECRET_ACCESS_KEY 未设置}"
: "${COS_REGION:?COS_REGION 未设置}"

umask 077
cat > "$CONF" <<EOF
[cos]
type = s3
provider = TencentCOS
access_key_id = $COS_ACCESS_KEY_ID
secret_access_key = $COS_SECRET_ACCESS_KEY
region = $COS_REGION
endpoint = cos.$COS_REGION.myqcloud.com
acl = private
EOF
chmod 600 "$CONF"

echo "== 桶连通性 =="
rclone --config "$CONF" lsd cos: 2>&1 | head -5
echo "== 目标前缀 =="
echo "$COS_REMOTE"
