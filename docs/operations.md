# 运营维护手册

> 阶段 9 产出。**当前项目尚未部署到生产**（部署方案见 `docs/deployment.md`），本手册按「本机/内测」与「部署后」两种形态写，已实现的能力与计划能力严格区分。

## 1. 服务概览

| 项 | 当前（内测，本机） | 部署后（计划） |
|---|---|---|
| 应用 | Next.js dev（`npm run dev`，:3000） | 云服务器 `next start` + Nginx 反代 |
| 数据库 | 自建 Supabase（Windows Docker，192.168.1.11:8000） | 云机 Docker 版裁剪 Supabase（或融合方案：数据留家机 + 云机入口） |
| 定时任务 | `pg_cron` 每日 03:05 `expire-members` | 同（迁移 026 重建） |
| 支付 | 已开（`BILLING_ENABLED=true`），人工核销 | 同，企业主体后接微信支付 |
| 访问方式 | 局域网 `http://192.168.1.12:3000` | `https://<备案域名>` |

## 2. 核心运行指标

| 指标 | 怎么取 | 当前基线 |
|---|---|---|
| 首页/关键页可用性 | `npm run check:env`（含 dev server 探活）或部署后拨测 | 本机 200 |
| 接口错误率 | 暂无采集（部署后看 Nginx 日志状态码分布） | `[未覆盖]` |
| 高德调用量/失败数 | 表 `amap_usage`（`day/service/calls/failures/key_slot`） | 15 行 |
| AI 提取用量 | 表 `user_daily_usage`（kind 维度） | 2 行 |
| 付费订单数 | 表 `member_orders` | **0 行（尚无真实订单）** |
| 注册用户 | 表 `users` | 3 行（内测账号） |

> 真实上线前，`member_orders` 为 0 意味着**付费链路从未经受真实用户检验**，这是头号运营风险。

## 3. 日志与监控

| 项 | 现在 | 部署后计划 |
|---|---|---|
| 应用日志 | dev server 终端输出 | `journalctl -u travel-food` |
| 访问日志 | 无 | Nginx `access.log` / `error.log` |
| 数据库日志 | Supabase 容器日志 | 同 |
| 告警 | 无 | 云监控站点拨测（每 5 分钟）+ 企微群机器人通知 |
| 禁止记录 | `.env` 值、用户密码、支付凭证 | 同 |

## 4. 备份与恢复

| 项 | 做法 | 频率 |
|---|---|---|
| 数据库 | `pg_dump`（docker exec）→ 本机 + 异地 | **每日**，保留 7 份本地 + 30 份异地 |
| 代码 | Git（GitHub 私有/公开仓库） | 每次提交 |
| 环境变量 | 服务器 `.env.local`（600 权限）+ 密码管理器另存一份 | 变更时 |
| 恢复演练 | **每季度一次**：从备份还原到临时库并核对行数 | 季度 |

恢复步骤：

```bash
docker exec -i <pg> psql -U postgres -d postgres < backup_YYYYMMDD.sql
# 校验基线（docs/data-model.md 有各表行数）
```

> **未演练过的备份不算备份**——这是本项目的硬要求。

## 5. 故障处理

| 症状 | 排查顺序 | 已知原因 |
|---|---|---|
| 全站 502 | Next 进程 → Nginx → 隧道（融合方案） | 家宽重播/断电、进程崩溃 |
| 页面卡 5–7s 后报「加载失败」 | Supabase 容器健康（`pg_isready`）、用业务接口探活 | **自建 Supabase 假死史**（TCP 通 HTTP 不回）；不要用 `/auth/v1/health` 判断 |
| 首个写请求 18s 超时 | 重试一次即可（GoTrue 空闲后首个请求超时，L43） | 容器空闲 |
| 高德报 10003/10007 | Key 白名单/私钥配置、额度 | `amap_usage` 可查 |
| 分享链接显示「已失效」 | 先重试；仍是则查 `route_shares.revoked_at` | 查询超时已与"确实不存在"分开（C9 已修） |
| 会员到期未失效 | `SELECT * FROM cron.job` 是否有 `expire-members`；`cron.job_run_details` 最近状态 | T-004 |
| 保存点位失败 | 看是否 500；新逻辑下原数据不会丢 | T-020 |

## 6. 用户反馈与迭代

- 收集渠道：微信群/私聊（内测期）、后续可加应用内反馈入口 `[未实现]`
- 记录位置：`docs/known-issues.md`（缺陷/风险）+ `docs/open-questions.md`（待决策）
- 响应时限：内测期建议 24 小时内回复
- 迭代入口（见 §7）：按触发类型回到对应阶段，不从头跑

## 7. 成本管理

| 项 | 计费方式 | 当前量级 | 控制手段 |
|---|---|---|---|
| 高德 Web 服务 | 按调用次数 | Key 池 2 槽、缓存 30 天 | 分桶限流（T01/T01b/T01c）、缓存优先 |
| DeepSeek | 按 token | 仅文案提取 | 游客 3 次/日、会员 20 次/日 |
| Supabase 自建 | 自有硬件 | 15MB | 裁剪服务（不用 Storage/Realtime） |
| 云服务器 | 年付 | 未购买 | 1C2G 足够（融合方案） |
| 域名/证书 | 年付/免费 | 未购买 | Let's Encrypt |

## 8. 商业与成本复盘（内测期）

- 免费档：每天 1 条路线、单日 6 个地点、AI 提取 10 次/日
- 会员档：每月 10 条路线、最长 7 天、单日 12 个地点、AI 提取 20 次/日
- 目标：验证「有人愿意付月卡」；**当前 0 笔真实订单**
- 风险：个人主体备案下收费的合规风险（`docs/decisions.md` D-15）

## 9. 交接信息

| 项 | 位置 |
|---|---|
| 代码 | GitHub `linyidong/lvyou-meishi-yitiaoxian` |
| 项目文档 | `docs/`（17 份，入口 `progress.md`） |
| 协作规则 | `AGENTS.md` |
| 交接摘要 | `docs/handover/`（阶段 0–8） |
| 自检命令 | `npm run check:env` / `check:cities` / `test:run` / `test:e2e` / `audit:mobile` |

## 10. 待确认

1. 正式域名与备案主体进度
2. 是否长期收费（决定要不要办经营性备案）
3. 是否需要监控告警（云监控/企微机器人）
4. 备份异地存放位置（云机 / 对象存储 / 另一块盘）
