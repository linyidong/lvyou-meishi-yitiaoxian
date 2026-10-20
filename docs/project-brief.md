> 状态：已核对（Harness 2026-10-20 23:58 复核：版本/命令/风险均已抽样验证，数据库事实见 `known-issues.md` §0）

# 项目简报（阶段 3 · 反向理解草稿）

依据：AGENTS.md §0、`docs/progress.md`、`docs/module-map.md`（448 行）、本轮源码与配置取证。本文是「项目现状」的汇总草稿，细节以同目录 4 份文档为准：`tech-stack.md`、`setup-and-run.md`、`known-issues.md`、`人工参数与环境配置.md`。

## 1. 项目用途

**旅行美食一条线**：自助旅行者选城市 → 设置行程（天数/出发点/住宿）→ 挑地点（导入文案 AI 提取 / 勾选收藏 / 搜索）→ 自动排路线（贪心最近邻 + 2-opt + 高德距离矩阵）→ 看地图与分段里程 → 保存为个人路线；支持游客免登录试用、会员分层配额、路线分享长图与二维码。[已确认]（AGENTS.md §0；核心链路见 `Project/app/try/`、`Project/app/api/try/order/route.ts:88`、`Project/lib/route-order.ts:173`）

## 2. 目标用户与身份分层

| 身份 | 能力 | 证据 |
|---|---|---|
| 游客（未登录） | 完整走通「新建路线」三步（`/try/new`→`/try/pick`→`/try/result`），仅「保存路线」须登录；顶部/底部工具栏全部置灰 | `Project/middleware.ts:29-32` 放行 `/try/*`；`Project/config/business.ts:72/79/85` 五桶限流 |
| 普通用户 | 每天 1 条路线、单日 6 地点、文案识别 10 次/日、1 次多日试用 | `Project/config/business.ts:127/131/135` |
| 会员 | 每月 10 条路线、单日 12 地点、识别 20 次/日；月卡 15 元/30 天（收款码人工核销） | `Project/config/business.ts:7/137/145` |
| 管理员 | 后台核销订单、用户/用量看板；自身享最高档不限额 | `Project/app/admin/`、`Project/config/business.ts` ADMIN 档 |

## 3. 功能现状分级

### 3.1 已实现（代码完整 + 有历史人工验证记录）[已确认]

1. **游客三步试用链路**：含导入地点合并勾选、sessionStorage 草稿、登录后转正（`Project/app/api/try/order/route.ts:102-108` manual 走 reorder 宽松桶）。
2. **路线排序与分段里程**：`orderByMatrix` 6 个调用方（`Project/lib/route-order.ts:173`，CodeGraph 实测）；算不出时直线估算兜底（`Project/app/api/try/order/route.ts:64`）。
3. **高德地图展示与操作**：JS API 1.4.15 动态注入（`Project/lib/amap-loader.ts:69`），结果页 `interactive` 已修。
4. **收藏**：基于 `places.is_collected`，无独立表（迁移 003/005 字段定义实测）。
5. **会员订单半自动闭环**：扫码提交订单 → 企微 Webhook 推管理员（`Project/lib/order-notify.ts:166`）→ 后台红色角标核销 → 用户端轮询感知。
6. **路线分享长图 + 二维码**：纯客户端 Canvas 自绘 + `qrcode` 1.5.4，不调高德静态图；令牌与账号绑定、导出作废旧令牌。
7. **高德省额度三件套**：Key 池轮询（`Project/config/env.ts:24-37`）、leg/geocode/搜索落库缓存 30 天 TTL、用量按 key_slot 落 `amap_usage`。
8. **防提权**：RLS + 4 个触发器；实测普通用户改 member/role 被 42501 拒绝（历史验证记录）。

### 3.2 部分实现（代码在、开关未全开或依赖外部条件）[已确认]

1. **企微自建应用通道**：代码完成（`Project/lib/order-notify.ts:100-143`），但 4 个 WECOM_* 变量未配置 → 通道关闭；启用还须备案域名+固定公网 IP（errcode 60020 前置）。
2. **高德 Key 池第 3 槽**：代码支持（`Project/config/env.ts:28`），`.env.local` 缺 `AMAP_WEB_SERVICE_KEY_3` → 实际 2 槽。
3. **国内部署**：腾讯云轻量方案已定（含备案硬性条件清单），**未实施**；当前仍是 Windows 宿主机 Docker 自建 Supabase + 本机 dev。

### 3.3 只有界面 / 只有接口（保护或实现不完整）[风险]

1. **`Project/app/api/amap/search/route.ts` 与 `Project/app/api/amap/landmarks/route.ts`**：接口存在且可用，但 handler 内**无 getUser 校验、无游客限流**，middleware 也不覆盖 `/api/*`（known-issues A5，本轮新发现；是否有意开放待用户确认）。
2. **旧版游客页 `Project/components/try/TryPickClient.tsx`**：界面在，但与普通用户页 `Project/components/route/RoutePlacesClient.tsx` 双实现并存（known-issues A4），分叉风险。
3. **`Project/public/750x750png`**：无扩展名残留文件，用途不明 [未知]。

### 3.4 未实现 [已确认]

1. **自动化测试**：0 框架 0 文件（无 jest/vitest/playwright，`Project/package.json` scripts 无 test）。
2. **CI/CD**：无 `.github/` 目录，无任何流水线。
3. **短信提醒通道**：grep 全项目无代码，纯口头预留。
4. **付款全自动回调**：个人经营收款码无官方回调 API，须待营业执照+商户号（历史教训）。
5. **服务端定时任务/事件队列**：无；会员到期为惰性判定，定时逻辑均为前端轮询或进程内队列。

## 4. 数据与接口概览（细节见 module-map 与 known-issues）

- 数据库：自建 Supabase（Postgres），**14 张表**（迁移实测：users/cities/places/routes/route_places/imports/events/member_logs/member_orders/route_shares/amap_leg_cache/amap_geocode_cache/amap_usage/user_daily_usage）；26 份迁移手工经 SQL Editor / `/pg/query` 应用。[已确认]
- 对外 API：**30 个 route handler**，鉴权矩阵已逐文件 grep（登录校验/admin 校验/游客限流/配额四维）；`limitsOf`（`Project/lib/member-quota.ts:90`）是全站配额单点（14 callers）。[已确认]
- 认证：Supabase Auth（邮箱密码），`Project/lib/supabase/middleware.ts` updateSession + `Project/middleware.ts` 路由守卫（仅页面级，不保护 /api/*）。[已确认]

## 5. 范围与约束（硬性）

- 城市固定 **92 座**（迁移 011 计数实测；`Project/config/cities.ts` 的 `name:` 计数 104 与之不一致，差异 [未知] 待 Harness 核）；单路线 ≤7 天、单日 ≤12 地点、单路线 ≤30 地点（`Project/config/business.ts:7/9/37`）。
- 游客限流五桶：city-places 100/日、order 3/日、reorder 60/日、import、ai-extract（`Project/config/business.ts:72-85`）。
- 收款码仅保留**月卡**档（`Project/config/business.ts:145` MEMBER_PLANS）；年卡/永久仅存历史枚举。
- 主色调统一 G1 玫红→紫渐变（`Project/config/product.ts:25-29`）；页面按墨刀原型实现。
- **必须部署在国内**（用户硬性要求）；`File-PRD/` 只读；`.env.local`、生产数据、收款码原图禁止触碰。
- 无测试框架 → 改动至少 `npm run typecheck`，运行时行为须人工走查并在汇报写「未覆盖」。

## 6. 当前进度（以 docs/progress.md 为准）

阶段 3 进行中；G1/G2 已通过；本文 5 份文档即 G3 交付物。已知阻塞：无。待用户决策：A5 鉴权口径、92/104 城市差异、测试框架引入、`750x750png` 处置、push 落后提交。

## 7. 证据标记口径

[已确认]=带全路径行号或命令输出；[高度可能]=代码注释/结构推断；[风险]=可证实的隐患；[未知]=本任务禁项或外部条件无法核实。
