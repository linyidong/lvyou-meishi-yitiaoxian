#!/usr/bin/env bash
# 云机：一次性初始化（Ubuntu 22.04）
# 用法：sudo bash cloud-oneclick.sh lyytx.com admin@example.com
set -euo pipefail
DOMAIN="${1:?域名}"
EMAIL="${2:?邮箱（Let's Encrypt 通知用）}"

apt-get update
apt-get install -y nginx frp certbot python3-certbot-nginx rsync ufw

# 防火墙：只放 22/80/443
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# frp 服务端
install -d /etc/frp
# 把 deploy/frps.toml 放到 /etc/frp/frps.toml 后：
systemctl enable frps 2>/dev/null || true

# Nginx 站点
# 把 deploy/nginx-lyytx.conf 放到 /etc/nginx/conf.d/lyytx.conf 后：
nginx -t && systemctl reload nginx

# 证书（DNS 已解析到本机后执行）
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" || \
  echo "⚠️ 证书未签发：确认 DNS 已解析到本机 IP 后再跑一次 certbot"

echo "✅ 云机初始化完成。检查：systemctl status nginx frps; nginx -t"
