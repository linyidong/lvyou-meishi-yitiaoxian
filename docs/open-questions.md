# 待确认问题（Open Questions）

> 阶段 3 起持续更新。每条只问一个问题；写清为什么现在不能确定、需要谁、影响什么。
> 解决后移到「已解决」，不直接删除。

## 1. 未解决

| ID | 问题 | 为什么无法确定 | 需要谁 | 影响 | 优先级 | 状态 |
|---|---|---|---|---|---|---|
| Q-002 | 24 份迁移是否都已在目标 Supabase 应用（025 曾用 `/pg/query` 执行过） | PostgREST 不暴露迁移表；需直连 Postgres 或查 `supabase_migrations.schema_migrations` | Harness（需数据库直连凭据） | 影响「改表结构前能否信任迁移链」 | 中 | 开放 |
| Q-003 | `Project/public/750x750png`（无扩展名 750×750 PNG）是素材还是下载残留 | 文件名与内容无法区分用途 | 用户 | 误提交污染仓库 / 误删丢素材 | 低 | 开放 |
| Q-004 | 两张对外收款码（`pay-qr-wechat.png` / `pay-qr-alipay.png`）裁剪是否彻底、有无头像昵称残留 | 需人眼看图 | 用户 | 泄露经营者信息 | 中 | 开放 |
| Q-005 | 是否引入自动化测试框架（playwright 候选） | 属投入决策，代码侧无依据 | 用户 | 决定阶段 7–8 验收强度与回归成本 | 中 | 开放 |
| Q-006 | 本地提交是否推送到 `origin/main` | 属用户发布习惯 | 用户 | 单点故障风险（目前仅本地 + 盘外备份） | 低 | 开放 |
| Q-007 | 企业微信自建应用通道何时启用（依赖备案域名 + 固定公网 IP） | 依赖外部条件（域名备案、固定 IP） | 用户 | 个人微信推送暂不可用，只能群机器人 | 中 | 开放 |
| Q-010 | A5 鉴权修复是否算「本期缺陷」 | 用户本期勾选里没勾它，但已决议且改动小 | 用户 | 影响本期任务清单 | 低 | 开放 |
| Q-011 | F-50 一键复位的覆盖页面与是否消耗额度 | **口径已确认**（用户批准 T-005/T-006 计划）：两页都覆盖、本地快照还原零请求不耗额度；游客页 T-005 已实施（2026-10-21，待人工走查），会员页 T-006 未开始 | 待 T-006 完成后移入已解决 | 影响实现方式与游客额度 | 高 | 口径已定，待 T-006 关闭 |
| Q-008 | `routes.transport` 的最终取值集合（004 迁移 check 为 walk/bike，018 扩到 4 种） | 需读 018 之后所有迁移并核对真实列定义 | Harness（可读迁移或查库） | 影响路线表单与分享校验口径 | 低 | 开放 |

## 2. 已解决

| ID | 问题 | 结论 | 依据 | 解决日期 |
|---|---|---|---|---|
| Q-101 | 库里到底有哪些表、多少数据 | 14 张表；users 3 / places 1326 / cities 92 / routes 5 / route_places 41 / imports 6 / events 42 / member_orders 0 / member_logs 3 / user_daily_usage 2 / route_shares 1 / amap_leg_cache 503 / amap_geocode_cache 228 / amap_usage 15 | Harness 直连 PostgREST（service_role 只读计数）＋ OpenAPI 表清单 | 2026-10-20 |
| Q-102 | RLS 是否真的挡住匿名读取 | **是**。匿名 key 请求 users / member_orders / places / routes / user_daily_usage / imports / events / amap_usage 全部返回 0 行；而 places 实际有 1326 行，排除「表本来就空」 | Harness 用 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 实测 8 张表 | 2026-10-20 |
| Q-103 | 本地能否跑起来 | 能。`npm run typecheck` exit 0；dev server 起得来（阶段 1 验证过 4 个页面 200、接口可调） | 阶段 1/3 实跑 | 2026-10-20 |
| Q-012 | 会员到期定时任务用哪种实现（pg_cron / 系统计划任务 / 应用内调度） | 需结合部署形态定，本期尚无生产部署 | Harness（阶段 6 方案） | 影响实现成本与可运维性 | 中 | 开放 |
| Q-009 | 城市清单是否错位（曾报 104 vs 92） | **误报**：`CITIES` 真值 92，与库内 92、迁移 011 的 92 完全一致。原 104 系 grep 口径错误 | TypeScript 编译求值（Harness 2026-10-21） | 2026-10-21 |
| Q-104 | 是否已有付费订单 | 没有。`member_orders` 0 行 | 只读计数 | 2026-10-20 |
| Q-001 | A5 两个无鉴权高德接口怎么处理 | **用户 2026-10-21 决定**：删除死接口 `Project/app/api/amap/search/route.ts`（无任何调用方）；`Project/app/api/amap/landmarks/route.ts` 增加 `getUser` 校验。作为阶段 7 任务执行 | 用户决策 + Harness 调用链排查（`grep amap/search` 零引用） | 2026-10-21 |

## 3. 假设清单

| ID | 假设 | 依据 | 信心 | 验证方式 | 状态 |
|---|---|---|---|---|---|
| A-001 | 数据表清单（14 张）与 25 份迁移一致 | 迁移文件 + PostgREST OpenAPI 双证；但迁移是否全部应用未核 | 高 | 查 `schema_migrations` 或逐表 diff | 待验证（Q-002） |
| A-002 | 游客读地点走 `service_role` 是有意设计（跨用户共享公开字段） | `module-map` 记录 + `.env` 存在 service key；RLS 实测挡住匿名，说明设计闭环 | 中 | 读 `Project/lib/supabase/admin.ts` 与调用点注释 | 待验证 |
| A-003 | 用户量 3、路线 5，属演示级数据，非生产 | 只读计数 | 高 | 上线前确认是否要清空/迁移 | 待验证 |

## 4. 使用规则

- 影响下一步的问题优先问；不影响下一步的先记录，继续推进。
- 产品决策类问题一次只问用户一个，问完更新三行（已确认 / 暂定 / 仍未知）。
- 问题解决后，同步更新 PRD、`decisions.md` 或相关文档，避免「答案只在聊天里」。
