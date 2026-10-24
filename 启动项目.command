#!/bin/bash
# 一键启动「旅行美食一条线」dev server（macOS，双击即用）
# 职责：已在跑→只开浏览器；未跑→自检环境→等自建 Supabase 就绪（三态提示，通了才起 dev）→前台启动 dev→就绪后自动开浏览器并打印手机地址
# 仅用 macOS 自带工具：bash / lsof / open / ipconfig / curl / nc / ping / sleep / grep / sed

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

# ③ 门禁：等待自建 Supabase 就绪——通了才启动 dev；未通每 5 秒重探并打印三态判定
#    （只读 .env.local 的 URL/anon key，绝不打印密钥；等待期间不起 dev，Ctrl+C 可放弃）
wait_for_supabase() {
  local env_file="$APP_DIR/.env.local" supa_url anon_key scheme host port probe_url waited=0 code
  if [ ! -f "$env_file" ]; then
    echo "❌ 找不到 $env_file，无法探测自建 Supabase。请确认环境配置后重试（Ctrl+C 退出）。"
    exit 1
  fi
  supa_url="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"')"
  anon_key="$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"')"
  if [ -z "$supa_url" ] || [ -z "$anon_key" ]; then
    echo "❌ $env_file 缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY（只检查了变量名，值未打印）。"
    exit 1
  fi
  scheme="${supa_url%%://*}"
  host="$(printf '%s' "$supa_url" | sed -E 's#^[a-z]+://##; s#[:/].*##')"
  port="$(printf '%s' "$supa_url" | sed -nE 's#^[a-z]+://[^:/]+:([0-9]+).*#\1#p')"
  [ -n "$port" ] || port=80

  # 仅调试用：覆盖探测目标（无 Windows 环境时模拟不可达态；不改变应用实际连接地址）
  if [ -n "${LYYTX_SUPABASE_HOST_OVERRIDE:-}" ]; then
    host="${LYYTX_SUPABASE_HOST_OVERRIDE%%:*}"
    case "$LYYTX_SUPABASE_HOST_OVERRIDE" in
      *:*) port="${LYYTX_SUPABASE_HOST_OVERRIDE##*:}" ;;
    esac
    echo "🧪 调试覆盖生效：门禁探测 ${host}:${port}（仅影响本提示，应用连接地址不变）"
  fi
  probe_url="${scheme}://${host}:${port}/rest/v1/cities?select=name&limit=1"

  echo "🗄️  等待自建 Supabase（${host}:${port}）就绪——期间不会启动 dev server，Ctrl+C 可放弃..."
  while true; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 6 -H "apikey: ${anon_key}" "$probe_url" 2>/dev/null || echo 000)"
    if [ "$code" = "200" ]; then
      echo "✅ 数据库已就绪（REST 200，共等待 ${waited}s），继续启动流程"
      echo ""
      return 0
    fi
    if nc -z -G 2 "$host" "$port" 2>/dev/null; then
      echo "⏳ [已等待 ${waited}s] 状态C：端口 ${port} 已通但 REST 返回 ${code}——容器可能还在启动或服务异常，继续等待（Ctrl+C 放弃）"
    elif ping -c 2 -t 3 "$host" >/dev/null 2>&1; then
      echo "⏳ [已等待 ${waited}s] 状态B：${host} 电脑在线（ping 通）但 Supabase 端口 ${port} 不通——Docker Desktop 或 Supabase 容器没启动；请到那台电脑启动 Docker 并 docker compose up -d（参考 docs/setup-and-run.md §6；Ctrl+C 放弃）"
    else
      echo "⏳ [已等待 ${waited}s] 状态A：${host} 不可达（ping 与端口 ${port} 都不通）——那台 Windows 电脑可能没开机，或本机未连同一 Wi-Fi/局域网；请开机或连网后自动会继续（Ctrl+C 放弃）"
    fi
    sleep 5
    waited=$((waited + 5))
  done
}
wait_for_supabase

# ④ 后台等待就绪：就绪后自动打开浏览器 + 打印手机访问地址
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
