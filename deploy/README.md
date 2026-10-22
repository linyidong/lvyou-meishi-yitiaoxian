# 部署配置（融合方案：云机入口 + 家机应用）

> 对应 `docs/deployment.md` §4.5。**本目录是准备件，尚未执行部署。**

架构：

```
用户 ──443──▶ 云机 139.199.191.102（Nginx + frps）
                 │  /            → 127.0.0.1:8080（隧道→家机 Next:3000）
                 │  /rest /auth  → 127.0.0.1:8081（隧道→家机 Supabase:8000）
                 ▼ frp 隧道
           家机（Mac/NUC）：Next + Supabase Docker + 每日 pg_dump → 云机
```

## 文件

| 文件 | 放哪 | 作用 |
|---|---|---|
| `tunnel.sh` | 家机 | SSH 反向隧道（替代 frp） |
| `com.lyytx.tunnel.plist` | 家机 `~/Library/LaunchAgents/` | 隧道常驻 + 自动重连（macOS） |
| `nginx-lyytx.conf` | 云机 `/etc/nginx/conf.d/` | 域名反代 + 502 维护页（备案后启用） |
| `next-app.service` | 家机 `/etc/systemd/system/` | Next 常驻（`next start`） |
| `backup-db.sh` | 家机 `~/bin/` | `pg_dump` + rsync 到云机 |
| `cloud-oneclick.sh` | 云机执行一次 | 装 Nginx/证书/防火墙的引导脚本 |

## 上线顺序（备案通过后）

1. 云机：`cloud-oneclick.sh` → 装 Nginx + certbot（隧道用 SSH，无需装 frp）
2. 家机：`tunnel.sh`（launchd 常驻）起隧道；`next-app.service` 起应用
3. 云机：`nginx-lyytx.conf` + 证书；DNS A 记录 → 云机 IP
4. 家机：`backup-db.sh` + cron；做一次还原演练
5. 跑 `docs/deployment.md` §8 烟雾测试

> 所有配置中的域名/IP 均为本项目实际值；密钥不入库（用环境变量或本地文件）。

## 为什么不用 frp

2026-10-22 实测：云机从 GitHub 下载 frp release **超时**（国内网络）。改用系统自带的 SSH 反向隧道：
- 零第三方二进制（安全面更小）
- 断线由 launchd `KeepAlive` + `ServerAliveInterval` 自动重连
- 远程端口显式绑 `127.0.0.1`，不暴露公网

代价：SSH 隧道在高并发下不如 frp 高效，但对当前量级（≤100 用户）足够。
