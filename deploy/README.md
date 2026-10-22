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
| `frps.toml` | 云机 `/etc/frp/` | 隧道服务端 |
| `nginx-lyytx.conf` | 云机 `/etc/nginx/conf.d/` | 域名反代 + 502 维护页 |
| `frpc.toml` | 家机 `/etc/frp/` 或 `~/.frp/` | 隧道客户端 |
| `next-app.service` | 家机 `/etc/systemd/system/` | Next 常驻（`next start`） |
| `backup-db.sh` | 家机 `~/bin/` | `pg_dump` + rsync 到云机 |
| `cloud-oneclick.sh` | 云机执行一次 | 装 Nginx/frp/证书的引导脚本 |

## 上线顺序（备案通过后）

1. 云机：`cloud-oneclick.sh` → 装 Nginx + frps + certbot
2. 家机：`frpc.toml` 起隧道；`next-app.service` 起应用
3. 云机：`nginx-lyytx.conf` + 证书；DNS A 记录 → 云机 IP
4. 家机：`backup-db.sh` + cron；做一次还原演练
5. 跑 `docs/deployment.md` §8 烟雾测试

> 所有配置中的域名/IP 均为本项目实际值；密钥不入库（用环境变量或本地文件）。
