#!/usr/bin/env bash
# 每小时健康检查：磁盘>80% / 内存>85% / 站点非200（含 502）/ 容器或应用未运行
# 只在异常时推送企业微信；同一组异常 24 小时内只推一次，恢复后自动重置
set -uo pipefail
WEBHOOK=$(grep -m1 '^ORDER_NOTIFY_WECOM_WEBHOOK=' /srv/lvyou/app/.env.local 2>/dev/null | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")
STATE=/srv/backup/.health-state
LOG=/srv/backup/health.log
TITLE='【警告】磁盘>80% / 内存>85% / 站点 502'
log(){ echo "[$(date '+%F %T')] $*" >> "$LOG"; }

send(){
  local text="$1"
  [ -n "$WEBHOOK" ] || { log "webhook 未配置，跳过推送"; return 0; }
  local out
  out=$(python3 - "$WEBHOOK" "$text" <<'PY'
import sys, json, urllib.request
url, text = sys.argv[1], sys.argv[2]
body = json.dumps({"msgtype": "text", "text": {"content": text}}).encode()
try:
    r = urllib.request.urlopen(urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=10)
    print(r.read(200).decode(errors="replace"))
except Exception as e:
    print("push failed:", type(e).__name__, e)
    sys.exit(1)
PY
)
  log "wecom: $out"
  echo "$out"
}

if [ "${1:-}" = "--test" ]; then
  send "$TITLE
当前触发：测试消息（非真实告警）
时间：$(date '+%F %T')
主机：139.199.191.102"
  exit 0
fi

fails=()
disk=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "${disk:-0}" -gt 80 ] && fails+=("磁盘使用 ${disk}%（阈值 80%）")
mem=$(free | awk '/Mem:/{printf "%d", $3/$2*100}')
[ "${mem:-0}" -gt 85 ] && fails+=("内存使用 ${mem}%（阈值 85%）")
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://lyytx.com/ 2>/dev/null)
[ -z "$code" ] && code=000
[ "$code" != "200" ] && fails+=("站点 https://lyytx.com/ 返回 ${code}（阈值：非 200）")
for c in supabase_db_1 supabase_auth_1 supabase_rest_1 supabase_kong_1; do
  st=$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || echo false)
  [ "$st" != "true" ] && fails+=("容器 $c 未运行")
done
st=$(systemctl is-active lvyou 2>/dev/null || echo inactive)
[ "$st" != "active" ] && fails+=("lvyou.service 状态 ${st}")

if [ ${#fails[@]} -eq 0 ]; then
  # 恢复正常：清掉状态，下次再出问题会立即告警
  [ -f "$STATE" ] && rm -f "$STATE" && log "recovered"
  log "ok disk=${disk}% mem=${mem}% site=${code}"
  exit 0
fi

msg=$(printf '%s；' "${fails[@]}")
now=$(date +%s)
last=$(cat "$STATE" 2>/dev/null || true)
# 同一组异常 24 小时内只推一次
if [ -n "$last" ] && [ "${last%%|*}" = "$msg" ] && [ $((now - ${last##*|})) -lt 86400 ]; then
  log "suppressed (24h): $msg"; exit 1
fi
echo "$msg|$now" > "$STATE"

detail=$(printf '· %s\n' "${fails[@]}")
send "$TITLE
当前触发：
$detail时间：$(date '+%F %T')
主机：139.199.191.102"
log "ALERT: $msg"
exit 1
