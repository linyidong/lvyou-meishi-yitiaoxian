#!/usr/bin/env bash
# 云机一次性配置：解析 /srv/backup/.cos.env（不经过 shell source）→ 生成 rclone 配置并自检
set -euo pipefail
ENVF="/srv/backup/.cos.env"
CONF="/srv/backup/rclone.conf"
[ -f "$ENVF" ] || { echo "缺少 $ENVF"; exit 1; }

python3 - "$ENVF" "$CONF" <<'PY'
import sys, pathlib, os
src, dst = sys.argv[1], sys.argv[2]
data = {}
for line in pathlib.Path(src).read_text(encoding="utf-8-sig", errors="replace").replace("\r", "").split("\n"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    data[k.strip()] = v.strip().strip('"').strip("'")
for k in ("COS_REMOTE", "COS_ACCESS_KEY_ID", "COS_SECRET_ACCESS_KEY", "COS_REGION"):
    if not data.get(k):
        raise SystemExit(f"缺少或为空: {k}")
cfg = f"""[cos]
type = s3
provider = TencentCOS
access_key_id = {data['COS_ACCESS_KEY_ID']}
secret_access_key = {data['COS_SECRET_ACCESS_KEY']}
region = {data['COS_REGION']}
endpoint = cos.{data['COS_REGION']}.myqcloud.com
acl = private
"""
p = pathlib.Path(dst)
p.write_text(cfg)
os.chmod(p, 0o600)
print("rclone.conf 已生成；REMOTE =", data["COS_REMOTE"], "| region =", data["COS_REGION"])
PY

echo "== 桶连通性 =="
rclone --config "$CONF" lsd cos: 2>&1 | head -5
