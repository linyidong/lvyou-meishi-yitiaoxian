#!/usr/bin/env bash
# 家机：SSH 反向隧道（替代 frp，不依赖第三方二进制）
# 云机 127.0.0.1:8080 → 家机 Next:3000
# 云机 127.0.0.1:8081 → Supabase Kong（注意：本机 Supabase 跑在局域网另一台机器（主机名 desktop-vrd3hft，端口 8000），
#                  不是 127.0.0.1；部署到别处时用 SUPABASE_HOST 覆盖）
# 说明：remote bind 显式绑 127.0.0.1，避免隧道端口暴露到公网
set -euo pipefail
CLOUD_HOST="${CLOUD_HOST:-ubuntu@139.199.191.102}"
KEY="${KEY:-$HOME/.ssh/id_lyytx_deploy}"
SUPABASE_HOST="${SUPABASE_HOST:-desktop-vrd3hft}"   # 自建 Supabase 所在机器的主机名（IP 由 DHCP 分配会变，别写死 IP）
SUPABASE_PORT="${SUPABASE_PORT:-8000}"

exec ssh -N \
  -R 127.0.0.1:8080:127.0.0.1:3000 \
  -R "127.0.0.1:8081:${SUPABASE_HOST}:${SUPABASE_PORT}" \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=accept-new \
  -o BatchMode=yes \
  -i "$KEY" \
  "$CLOUD_HOST"
