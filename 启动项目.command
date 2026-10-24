#!/bin/bash
# 一键启动「旅行美食一条线」dev server（macOS，双击即用）
# 职责：已在跑→只开浏览器；未跑→自检环境→前台启动 dev→就绪后自动开浏览器并打印手机地址
# 仅用 macOS 自带工具：bash / lsof / open / ipconfig / curl / sleep

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT/Project"
PORT=3000
URL="http://localhost:${PORT}"

cd "$APP_DIR" || { echo "❌ 找不到项目目录：$APP_DIR"; exit 1; }

port_listening() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }

# 局域网 IP 动态获取（en0 优先，其次 en1；取不到返回空，不硬编码）
lan_ip() { ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true; }

print_access_addrs() {
  local ip
  ip="$(lan_ip)"
  if [ -n "$ip" ]; then
    echo "💻 本机访问：$URL"
    echo "📱 手机访问：http://${ip}:${PORT}（手机需与本机同一 Wi-Fi）"
  else
    echo "💻 本机访问：$URL"
    echo "📱 手机访问：未取到局域网 IP（ipconfig getifaddr en0/en1 为空），请自行确认本机 Wi-Fi 地址后手动访问 http://<本机IP>:${PORT}"
  fi
}

# ① 已在运行 → 只打开浏览器，不重复启动
if port_listening; then
  echo "✅ 端口 ${PORT} 已在监听，dev server 看起来已在运行，直接打开浏览器"
  open "$URL"
  print_access_addrs
  exit 0
fi

# ② 环境自检：失败只警告不阻塞（Supabase 在另一台机器，没开机也能先起页面）
echo "🔍 环境自检（npm run check:env）..."
if ! npm run check:env; then
  echo ""
  echo "⚠️  环境自检未全部通过（详见上方 ✅/❌ 逐项结果）。"
  echo "    · 若失败项是「dev server」：属预期——本脚本马上就会把它启动，无需处理。"
  echo "    · 若失败项是「自建 Supabase」：需在那台机器的 Docker 里把 Supabase 容器起来（docker compose up -d），参考 docs/setup-and-run.md §6；现在仍会继续启动，但查库功能（登录/路线/后台）可能报错。"
  echo ""
fi

# ③ 后台等待就绪：就绪后自动打开浏览器 + 打印手机访问地址
(
  for _ in $(seq 1 120); do
    if port_listening; then
      sleep 1  # 给 next 一点时间完成首次编译前的监听稳定
      open "$URL"
      echo ""
      echo "🚀 dev server 已就绪，浏览器已自动打开"
      print_access_addrs
      echo ""
      exit 0
    fi
    sleep 1
  done
  echo "⚠️  等待 120 秒端口 ${PORT} 仍未就绪，请检查上方日志（可能端口被占或启动失败）"
) &

# ④ 前台启动 dev server（用户能在终端窗口看到日志/报错/热更新；Ctrl+C 可停）
echo "🚀 启动 dev server：npm run dev -- -H 0.0.0.0 -p ${PORT}"
echo "   （本窗口保留运行日志；停止可双击「停止项目.command」或直接 Ctrl+C）"
echo ""
exec npm run dev -- -H 0.0.0.0 -p "$PORT"
