#!/usr/bin/env bash
# 云机安全部署：备份 .next → 停服 → build → 成功启动并清理；失败/中断则回滚旧 .next 并启动。
# 用法（云机）：bash /srv/backup/remote-deploy.sh
set -uo pipefail
APP=/srv/lvyou/app
BACKUP="$APP/.next.bak-$(date +%Y%m%d-%H%M%S)"
cd "$APP" || exit 1

finish() {
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "[deploy] 构建失败/被中断，回滚旧 .next"
    rm -rf "$APP/.next"
    [ -d "$BACKUP" ] && mv "$BACKUP" "$APP/.next"
  else
    rm -rf "$BACKUP"
  fi
  sudo systemctl start lvyou || true
  echo "[deploy] lvyou=$(systemctl is-active lvyou)"
  exit "$rc"
}
trap finish EXIT INT TERM

sudo systemctl stop lvyou
cp -a "$APP/.next" "$BACKUP"
NODE_OPTIONS=--max-old-space-size=2048 npm run build
