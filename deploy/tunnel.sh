#!/usr/bin/env bash
# 家机：SSH 反向隧道（替代 frp，不依赖第三方二进制）
# 把云机 127.0.0.1:8080 → 家机 3000（Next），127.0.0.1:8081 → 家机 8000（Supabase Kong）
# 说明：remote bind 显式绑 127.0.0.1，避免隧道端口暴露到公网
set -euo pipefail
CLOUD_HOST="${CLOUD_HOST:-ubuntu@139.199.191.102}"
KEY="${KEY:-$HOME/.ssh/id_lyytx_deploy}"

exec ssh -N \
  -R 127.0.0.1:8080:127.0.0.1:3000 \
  -R 127.0.0.1:8081:127.0.0.1:8000 \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=accept-new \
  -o BatchMode=yes \
  -i "$KEY" \
  "$CLOUD_HOST"
