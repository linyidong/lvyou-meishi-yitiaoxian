> 状态：已核对（Harness 2026-10-21 00:10 复核：结构、鉴权口径、数据模型均与代码/库一致；偏差记入 known-issues B9）

# 系统架构（阶段 4 · 反向恢复，只写当前已存在的事实）

> 口径：本文描述**当前代码与数据库中已经存在**的结构。每条结论带全路径 `文件:行号` 或命令输出。素材来源：`docs/module-map.md`（448 行，阶段 2 CodeGraph 取证）、本轮 25 份迁移与 30 个 route 全文阅读、`docs/known-issues.md` §0 Harness 复核。

## 1. 系统组成

| 组件 | 形态 | 证据 |
|---|---|---|
| Web 应用 | Next.js 14.2.15（App Router）单体，React 18.3.1 + TypeScript 5.9.3 strict + TailwindCSS 3.4.19；`npm run dev` 端口 3000 | `Project/package.json:6-10`、`docs/tech-stack.md` |
| 路由入口 | 23 个 `page.tsx` + 2 个 `layout.tsx` + 30 个 `route.ts`，合计 55 个入口 | `find Project/app -name 'page.tsx'`（23）/ `'layout.tsx'`（2）/ `'route.ts'`（30）`[已确认]` |
| 数据库 | 自建 Supabase（Postgres + PostgREST + GoTrue Auth + RLS），14 张表、25 份迁移 | Harness 实测（`docs/open-questions.md` Q-101/Q-102）；`Project/supabase/migrations/001…025` |
| 地图 | 高德 JS API 1.4.15（前端动态注入）+ 高德 Web 服务（服务端 Key 池，代码支持 3 槽、实配 2 槽） | `Project/lib/amap-loader.ts:69`、`Project/config/env.ts:24-37` |
| AI 提取 | DeepSeek（文案 → 地点/城市识别） | `Project/lib/deepseek.ts:57` `extractPlacesAndCity` |
| 订单提醒 | 企业微信双通道：群机器人 Webhook（已启用）+ 自建应用消息（代码完成、凭证未配置、通道关闭） | `Project/lib/order-notify.ts:166-167` |
| 会话 | Supabase Auth 邮箱密码，cookie 会话（`sb-*-auth-token`），`@supabase/ssr` 解析 | `Project/lib/supabase/middleware.ts:34` |

**明确不存在的东西** `[已确认]`：
- 无事件队列（全仓无 Kafka/RabbitMQ/BullMQ/SQS/worker；唯一含 `queue` 的是 `Project/lib/amap.ts:79` 进程内高德 QPS 串行队列）。
- 无服务端定时任务（无 `vercel.json`、无 cron；`setInterval` 共 5 处且全部在浏览器端：`Project/lib/heartbeat.ts:45`、`Project/lib/amap.ts:353`、`Project/components/layout/AdminShell.tsx:71`、`:99`、`Project/components/profile/MemberCard.tsx:155`）。
- 无 CLI（`Project` 下无 `bin/`、无自定义 `*.mjs`/`*.sh`；`Project/package.json` 仅 next 的 5 个脚本）。
- 无自动化测试（`find Project -name "*.test.*"` → 空）、无 CI/CD（无 `.github/`）。

## 2. 模块职责（分层现状）

| 层 | 目录 | 职责 | 关键文件与行数 | 边界事实 |
|---|---|---|---|---|
| 路由层 | `Project/app` | 页面编排（Server Component 取数）+ 30 个 API 端点 | `app/(user)/*`、`app/admin/*`、`app/api/**/route.ts` | 存在 3 个页面绕过 API 层直接查库（见 §6 技术债 T-3）`[已确认]` |
| 交互组件层 | `Project/components` | 地图、拖拽排序、表单、后台表格、布局外壳 | 最大：`components/route/RouteResultClient.tsx`(1930) | **不直连数据库**：`grep -rn "lib/supabase" Project/components` → 无匹配，约束当前成立 `[已确认]` |
| 领域服务层 | `Project/lib` | 高德、DeepSeek、配额、排序、分享、海报、草稿、限流、通知 | `lib/amap.ts`(814)、`lib/member-quota.ts`(304)、`lib/route-order.ts`(224) | lib 兼具「服务 + 数据访问」双职责：`lib/route-share.ts`、`lib/amap.ts`、`lib/member-quota.ts`、`lib/amap-usage.ts` 均调用 `createAdminClient` `[已确认]` |
| 常量层 | `Project/config` | 配额/枚举/文案/路由/环境的全局单一来源 | `business.ts`(190 行/54 引用)、`enums.ts`(276/57)、`messages.ts`(1685/91)、`routes.ts`(73/53)、`env.ts`(94/10)、`product.ts`(86/15)、`cities.ts`(396/3) | 无运行时副作用；`env.ts` 只做 `process.env` 静态读取（逐个静态书写，动态键名打包不内联，`Project/config/env.ts:21-22` 注释）`[已确认]` |
| 类型层 | `Project/types` | 纯类型，零运行时代码 | 7 文件 302 行 | — `[已确认]` |
| 数据访问工厂 | `Project/lib/supabase` | 4 种运行环境的 Supabase 客户端 | `admin.ts:9`(service_role 绕 RLS)、`server.ts:28`(注入 `noStoreFetch`)、`client.ts`(浏览器)、`middleware.ts:12`(`updateSession`)、`fetch.ts:22`(`noStoreFetch`：no-store + 5s 超时) | `admin.ts` 只能服务端引入；`createAdminClient` 共出现在 22 个文件（app 17 + lib 5）`[已确认]` |
| 拦截器 | `Project/middleware.ts` | 唯一鉴权拦截点：登录态 + 管理员角色 + 重定向 | `middleware.ts:20`、matcher `:56-58` | 只保护页面，**不覆盖 `/api/*`**（见 §5）`[已确认]` |
| 数据库迁移 | `Project/supabase/migrations` | 25 份 SQL（表/RLS/触发器/种子） | 001~025，字段级细节见 `docs/data-model.md` | 迁移经 Supabase SQL Editor / `/pg/query` 手工应用 `[已确认]` |

## 3. 数据流（四条主链路，当前实现）

> 完整跳数行号见 `docs/module-map.md` §3（本节为摘要，全部 `[已确认]`）。

**链路 ①：游客试用生成路线（免登录）**
`/city` 选城 → `/try/new`（复用 `Project/components/route/TripSettingsFields.tsx`，`sections={['origin']}` 裁剪，`Project/components/try/TryNewClient.tsx:247`）→ `/try/pick` → `GET /api/try/city-places`（`Project/app/api/try/city-places/route.ts:33`，`city-places` 桶 100 次/日，`service_role` 跨用户读 `places`）→ `/try/result` → `POST /api/try/order`（`Project/app/api/try/order/route.ts:88`；`manual ? 'reorder' : 'order'` 双桶，`:106`）→ `cachedDistanceMatrix`（`Project/lib/amap.ts:650`：进程内 10 分钟缓存 → `amap_leg_cache` 落库缓存 → 高德 `/v3/distance` `:607`）→ `orderByMatrix` 最近邻+2-opt（`Project/lib/route-order.ts:173`）→ `planDayRoute`/`planLeg` 逐段算路（`Project/lib/amap.ts:532`/`:502`）→ 失败兜底 `estimateLeg` 直线×1.3（`Project/app/api/try/order/route.ts:64`）。游客导入地点走 `POST /api/try/extract`（DeepSeek + 高德搜索），结果只写浏览器 sessionStorage 草稿（`Project/lib/draft.ts:87-106`），不落库。

**链路 ②：游客草稿转正落库**
`/try/result` 保存按钮（`Project/components/try/TryResultClient.tsx:480`）→ 登录后 `POST /api/try/promote`（`Project/app/api/try/promote/route.ts:54`）→ `limitsOf(tier)` 档位校验（`Project/lib/member-quota.ts:90`）→ `places.insert`（`:201`，失败 `rollbackPlaces` `:176`）→ `routes.insert`（`:229`）→ `route_places.insert`（`:253`）→ `consumeRouteQuota`（`Project/lib/member-quota.ts:257`，月桶落 `user_daily_usage`）。

**链路 ③：会员订单半自动闭环**
`Project/components/profile/MemberCard.tsx:121` → `POST /api/member/orders`（待核销上限校验 `route.ts:66-71`、`member_orders.insert` `:75-76`、`notifyNewMemberOrder` `:92` → 企微 Webhook `Project/lib/order-notify.ts:73`）→ 管理员侧边栏角标轮询（`Project/components/layout/AdminShell.tsx:71` → `GET /api/admin/member/orders/pending-count`）→ 核销 `POST /api/admin/member/orders/[id]`（PENDING 校验 `:54`/`:61` → `users.update` member/member_until `:88-94` → `member_logs.insert` `:101` → 订单 APPROVED `:109-111`）→ 用户端轮询 `GET /api/member/orders/status`（`isMemberActive` 惰性判定，`route.ts:18-22`）自动关闭扫码页。

**链路 ④：登录/鉴权**
`Project/components/auth/LoginClient.tsx:81` → `POST /api/auth/login`（`signInWithPassword` `route.ts:38`、读 `users` `:68`）→ Set-Cookie → 此后每次页面请求经 `Project/middleware.ts:20` → `updateSession`（`Project/lib/supabase/middleware.ts:12`）→ `auth.getUser()`（`:34`）→ 按 `Project/config/routes.ts:56`(PROTECTED)/`:62`(GUEST_TRY)/`:65`(ADMIN) 分流；管理员角色查询失败默认拒绝（`Project/middleware.ts:40-42`）。

## 4. 外部集成清单（当前实际接线）

| 集成 | 方向 | 实现位置 | 当前状态 |
|---|---|---|---|
| 高德 Web 服务 `/v3/distance`（距离矩阵） | 服务端出 | `Project/lib/amap.ts:607` | 在用；结果落 `amap_leg_cache`（30 天 TTL，`Project/supabase/migrations/019`）`[已确认]` |
| 高德 Web 服务 `/v3/direction`（逐段算路） | 服务端出 | `Project/lib/amap.ts` `planLeg:502` | 在用 `[已确认]` |
| 高德 Web 服务 `place/text`（POI 搜索） | 服务端出 | `Project/lib/amap.ts:778` `searchPlaces` | 在用；按 (城市,关键词) 落 `amap_geocode_cache` 类缓存 30 天 `[已确认]` |
| 高德 Key 池轮询 | — | `Project/lib/amap-key-pool.ts:34` `pickWebKeySlot`；槽位收集 `Project/config/env.ts:24-37` | 代码 3 槽；`.env.local` 实配 2 槽（缺 `AMAP_WEB_SERVICE_KEY_3`）`[已确认]` |
| 高德串行队列/QPS 防护 | — | `Project/lib/amap.ts:79` `amapQueue`（间隔 ≥350ms、退避重试） | 在用 `[已确认]` |
| 高德用量与熔断 | 服务端 | `Project/lib/amap-usage.ts:165`/`:182`/`:195`；`amap_usage` 表按 `key_slot` 维度（迁移 019/024） | 用量 flush 为浏览器端定时器（`Project/lib/amap.ts:353`）`[已确认]` |
| 高德 JS API 1.4.15 | 浏览器 | `Project/lib/amap-loader.ts:53` `loadAmap`（`document.createElement('script')` 动态注入，`:68-69`） | 在用；1.4 不需要 securityJsCode（`:7` 注释），`NEXT_PUBLIC_AMAP_SECURITY_CODE` 全项目无消费点 `[已确认]` |
| DeepSeek 文案提取 | 服务端出 | `Project/lib/deepseek.ts:57` | 在用；缺 `DEEPSEEK_API_KEY` 时调用 throw（`:58-59`）`[已确认]` |
| 企业微信群机器人 Webhook | 服务端出 | `Project/lib/order-notify.ts:73`、聚合 `:166` | **已启用**（`ORDER_NOTIFY_WECOM_WEBHOOK` 已配置）`[已确认]` |
| 企业微信自建应用消息 | 服务端出 | `Project/lib/order-notify.ts:100-143`、启用条件 `:167` | **代码完成、通道关闭**：4 个 `WECOM_*` 变量未配置；启用另需备案域名+固定 IP（errcode 60020）`[已确认]` |
| Supabase Auth | 双向 | `Project/lib/supabase/*` 4 工厂 | 在用；注册走 `admin.createUser(email_confirm:true)` 绕 SMTP（`Project/app/api/auth/register/route.ts:44-49`）`[已确认]` |

## 5. 权限模型（当前双层结构）

1. **页面级（middleware）**：`Project/middleware.ts:20-50` 按三类常量分流——受保护页重定向登录（`Project/config/routes.ts:56`）、`/try/*` 与 `/city` 等免登录放行（`:62`，游客口径见 `middleware.ts:29-32`）、`/admin/*` 校验 `users.role==='admin'` 否则拒绝（`:35-45`）。matcher 仅排除静态资源（`:56-58`）。**middleware 不保护 `/api/*`**——API 鉴权全部在 handler 内自实现 `[已确认]`。
2. **接口级（handler）**：30 个 route 逐文件实测（`docs/api-contract.md`）分四类——`getUser` 登录校验（多数）、管理员二次校验（`admin/*` 6 个 + `seed-demo`，模式：`role !== 'admin'` → 403，如 `Project/app/api/admin/seed-demo/route.ts:85-88`）、游客限流桶（`try/*` 4 个 + `ai/extract` 游客分支，`Project/lib/guest-rate-limit.ts:109`，五桶额度 3/100/60 等按接口成本分层，`Project/config/business.ts:72/79/85`）、**无鉴权**（仅 `POST /api/amap/landmarks` `Project/app/api/amap/landmarks/route.ts:27` 与 `POST /api/amap/search` `Project/app/api/amap/search/route.ts:9` 两个，known-issues A5；处置已决策，见 `docs/decisions.md` D-010）。
3. **数据库级（RLS + 触发器）**：14 张表全部开启 RLS（匿名 key 读 8 张敏感表实测 0 行，Harness Q-102）；防提权触发器 4 个（`prevent_role_change` 迁移 010:27-46、`prevent_member_self_grant` 014→021:95-113 扩至 5 字段、`handle_new_user` 010:5-22、`sync_admin_member` 015:24-48），守卫共同口径：`auth.uid()` 为 null（即 service_role）放行 `[已确认]`。
4. **配额层**：`limitsOf`（`Project/lib/member-quota.ts:90`）是全站配额单点，14 个调用方（CLI `codegraph callers limitsOf` 实测）；档位判定 `tierOf:64` + 会员惰性有效 `isMemberActive:78`（`member=true` 且 `member_until` null=永久/未来=有效）；路线配额月桶经迁移 025 落 `user_daily_usage`（kind=`generate_route_month`，day 存当月 1 号）。
5. **service_role 越权面**：`createAdminClient` 出现在 22 个文件（app 17 + lib 5），绕 RLS；任何一处把用户可控输入拼进查询都可能越权——静态分析无法逐处证明，属人工审查面（`docs/module-map.md` §5-12）`[风险]`。

## 6. 技术债（当前存在、均有证据）

| # | 债务 | 证据 | 影响面 |
|---|---|---|---|
| T-1 | 两个高德代理接口无鉴权：`/api/amap/landmarks`、`/api/amap/search`（middleware 不覆盖 `/api/*`） | `Project/app/api/amap/landmarks/route.ts:27`、`Project/app/api/amap/search/route.ts:9` handler 内无 `getUser`/限流；known-issues A5 | 可被匿名调用消耗高德额度；处置已决策（`docs/decisions.md` D-010），**代码尚未改** |
| T-2 | 游客页与普通用户页双实现：`TryPickClient`(572 行) vs `RoutePlacesClient`(526 行)，`filterTabCls`/`pickCls`/`typeIconCls` 各写一份；`SortablePlaceRow` 两份（`RouteResultClient.tsx:444` vs `TryResultClient.tsx:88`） | `docs/module-map.md` §4.3 行号实测 | 必然分叉（AGENTS.md L48 教训已在此复现） |
| T-3 | 3 个 Server Component 页面直连库（`service_role` 绕 RLS、绕过 API 入参校验） | `Project/app/admin/orders/page.tsx:8`/`:14`、`Project/app/(user)/city/page.tsx:3`/`:14`、`Project/app/share/[token]/page.tsx:8`/`:20`/`:54` | 改表结构需同时改页面 |
| T-4 | 重复工具函数 7 组：`straightMeters`（`amap/route:29` vs `try/order:50`）、`estimateLeg`（`:43` vs `:64`）、`localDayString`×3（`member-quota.ts:148`/`guest-rate-limit.ts:37`/`amap-usage.ts:81`）、`isActive`×2、`nullableText`×2、`fmtTime`×5 | `docs/module-map.md` §4.3 | 距离/时区/格式口径改一处漏其余 |
| T-5 | 双提取接口正文重复：`ai/extract`(131 行) vs `try/extract`(157 行)，差异仅在鉴权与限流桶 | `Project/app/api/ai/extract/route.ts:29`、`Project/app/api/try/extract/route.ts:47` | 改提取规则需同时改两处 |
| T-6 | 游客限流为**进程内 Map** 计数（`CLEANUP_THRESHOLD=2000`），重启/多实例即清零，非持久化 | `Project/lib/guest-rate-limit.ts:109` 起 | 限流可被重启绕过；单实例部署下当前可用 |
| T-7 | 高德缓存读写失败静默（catch 后按未命中处理）→ 额度被静默多消耗 | `Project/lib/amap.ts:235-238` | 省额度机制可能无声失效 |
| T-8 | 超大文件：`RouteResultClient.tsx` 1930 行、`messages.ts` 1685 行/91 引用、`RouteAddClient.tsx` 859、`amap.ts` 814、`TryResultClient.tsx` 736 | `wc -l` 实测（`docs/module-map.md` §4.4） | 单点改动风险与冲突面大 |
| T-9 | 无自动化测试、无 CI；`typecheck` 是唯一机器校验（当前 EXIT=0） | `find` 空、无 `.github/`；`docs/setup-and-run.md` 实测 | 一切行为回归依赖人工走查 |
| T-10 | 无服务端定时兜底：会员到期为惰性判定（存储值不自动翻转）、`amap_usage` flush 依赖浏览器定时器 | `docs/module-map.md` §1.6 `[风险]` 注 | 长期无人开页面时统计滞后 |
| T-11 | 环境缺口：`.env.local` 缺 9 个变量（企微 4 + 高德私钥 3 + Web Key 槽 3 + JS Key 槽 2），对应功能降级运行 | `docs/人工参数与环境配置.md` §6 实测 | 详见该文档缺失后果表 |
| T-12 | 11 笔本地提交未 push（截至本轮 `git status`/`git log` 观察，见 `docs/progress.md`） | `docs/progress.md` | 远端仓库落后本机状态 |

## 7. 证据来源

- `docs/module-map.md`（阶段 2，448 行）：入口清单 §1、目录职责与 lib 导出 §2/§2.1、四条调用链 §3、重复实现/超大文件/影响面 §4、静态盲区 §5；其中 MCP 证据 = `mcp_codegraph_codegraph_explore`，CLI 证据 = `codegraph callers <符号>` 原始输出。
- `docs/data-model.md`（本轮）：25 份迁移 SQL 全文阅读的字段/函数/策略行号。
- `docs/api-contract.md`（本轮）：30 个 route 文件逐文件阅读（3 个 Explore 子代理 + 主会话补读 13 文件），方法经 `grep "export async function"` 实测（33 个 handler）。
- `docs/known-issues.md` §0：Harness 复核结论（RLS 实测、typecheck、14 表行数）。
- `docs/open-questions.md`：Q-001（A5 处置已决策）、Q-002~Q-008。
- `docs/人工参数与环境配置.md`：18 个变量名、`.env.local` 实存 9/缺失 9 的 grep 实测。
- `Project/package.json:6-10`、`Project/middleware.ts`、`Project/config/*.ts`、`Project/lib/*.ts`、`Project/app/**/route.ts` 源码行号（本文内联引用）。

## 8. 待确认事项

1. **middleware 运行时真实匹配范围**：`config.matcher` 的排除规则之外的路径是否全部经过拦截，属 Next.js 框架运行时行为，静态分析无法证明（`docs/module-map.md` §5-2）[未知]。
2. **Key 池熔断/降级的完整分支**：`getExhaustedWebKeySlots`（`Project/lib/amap-usage.ts:182`）在请求路径上的实际接线点未逐行取到；「所有 Key 达 95% 才整体降级为直线估算」口径来自历史决策，代码分支未逐行核 [高度可能]。
3. **service_role 越权面逐处审查**：22 个 `createAdminClient` 文件中是否存在把用户输入带进跨用户查询的实例，本轮只完成接口层审计，lib 内部查询条件未逐一核对 [未知]。
4. **`cityAdcode` 为空时的算路行为**、**`rollbackPlaces` 二次失败残留**（`docs/module-map.md` §3 未覆盖分支）[未知]。
5. **多实例部署下的限流/缓存一致性**：T-6/T-7 在单实例 dev 场景可接受，正式部署形态（国内云单机 or 多实例）确定后需重新评估 [未知]。
