#!/bin/bash
# 在桌面生成可双击的「启动项目.app」（macOS 自带 osacompile，无需额外工具）
# 双击该 .app = 打开 Terminal 窗口并运行项目根目录的「启动项目.command」（日志可见）
# 重复运行会覆盖旧 .app。图标定制为可选项，本脚本不做。

set -eu

ROOT="$(cd "$(dirname "$0")" && pwd)"
CMD="$ROOT/启动项目.command"
DESKTOP="$HOME/Desktop"
APP="$DESKTOP/启动项目.app"

[ -f "$CMD" ] || { echo "❌ 找不到 $CMD，请在项目根目录运行本脚本"; exit 1; }
chmod +x "$CMD" 2>/dev/null || true
mkdir -p "$DESKTOP"

rm -rf "$APP"
osacompile -o "$APP" \
  -e 'tell application "Terminal"' \
  -e 'activate' \
  -e "do script \"'$CMD'\"" \
  -e 'end tell'

echo "✅ 已在桌面生成：$APP"
echo "   双击它即可启动项目（等效于双击「启动项目.command」，会打开终端窗口显示日志）。"
