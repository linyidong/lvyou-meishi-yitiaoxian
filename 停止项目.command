#!/bin/bash
# 停止「旅行美食一条线」dev server（macOS，双击即用）
# 口径：只停 3000 端口上确属本项目的进程（命令行含项目路径，或进程工作目录在项目内），
#       绝不用 pkill -f node（会误杀其它 node 进程）。

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=3000

port_listening() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }

PIDS="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
if [ -z "$PIDS" ]; then
  echo "ℹ️  端口 ${PORT} 当前没有监听进程，dev server 未在运行，无需停止。"
  exit 0
fi

KILLED=0
for PID in $PIDS; do
  CMD="$(ps -o command= -p "$PID" 2>/dev/null || true)"
  # next dev 的子进程（next-server）命令行不含路径，用工作目录兜底校验
  CWD="$(lsof -p "$PID" -a -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  if echo "$CMD" | grep -q "$ROOT" || [ "${CWD#"$ROOT"}" != "$CWD" ]; then
    echo "🛑 停止本项目 dev server：PID ${PID}（命令：${CMD:-未知}；工作目录：${CWD:-未知}）"
    kill "$PID" 2>/dev/null || true
    KILLED=1
  else
    echo "⚠️  PID ${PID} 在监听 ${PORT}，但命令行与工作目录都不属于本项目，跳过不动："
    echo "     命令：${CMD:-未知}｜工作目录：${CWD:-未知}"
  fi
done

if [ "$KILLED" -eq 0 ]; then
  echo "ℹ️  未找到属于本项目的监听进程，没有杀任何进程。"
  exit 0
fi

# next dev 父进程不监听端口（lsof 查不到），子进程被杀后可能滞留；按完整命令行精确清理
for PPID2 in $(ps -eo pid=,command= | awk -v r="$ROOT" 'index($0, r "/Project/node_modules/.bin/next dev") {print $1}'); do
  echo "🛑 清理滞留的 next dev 父进程：PID ${PPID2}"
  kill "$PPID2" 2>/dev/null || true
done

# 等待端口释放；10 秒后仍未释放则对同一批已校验 PID 升级 SIGKILL
for _ in $(seq 1 10); do
  port_listening || { echo "✅ 已停止，端口 ${PORT} 释放。"; exit 0; }
  sleep 1
done

for PID in $PIDS; do
  CMD="$(ps -o command= -p "$PID" 2>/dev/null || true)"
  CWD="$(lsof -p "$PID" -a -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  if echo "$CMD" | grep -q "$ROOT" || [ "${CWD#"$ROOT"}" != "$CWD" ]; then
    echo "🛑 优雅停止超时，强制结束 PID ${PID}"
    kill -9 "$PID" 2>/dev/null || true
  fi
done

for _ in $(seq 1 5); do
  port_listening || { echo "✅ 已停止（强制），端口 ${PORT} 释放。"; exit 0; }
  sleep 1
done

echo "⚠️  端口 ${PORT} 仍被监听，请手动排查：lsof -nP -iTCP:${PORT} -sTCP:LISTEN"
exit 1
