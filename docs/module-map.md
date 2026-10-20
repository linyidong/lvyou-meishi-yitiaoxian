# 代码结构地图（阶段 2 · P2）

> 产出阶段：阶段 2（CodeGraph 代码地图）
> 建立时间：2026-10-20
> 代码根：`/Volumes/Programming/Project-File/AI-lvcingyitiaoxian/Project`
> 证据口径：**只写有证据的边**。每条结论末尾标注 `[已确认]` / `[高度可能]` / `[未知]` / `[风险]`。
> `[已确认]` 一律带 `文件:行` 或命令原始输出。
> 图谱证据一律注明来源：**MCP** = `mcp_codegraph_codegraph_explore`；**CLI** = 终端 `codegraph <子命令>`（均给出原始命令）。
> 本阶段**未修改任何源码**，仅新建本文件。

## 0. 取证环境

| 项 | 值 | 证据 |
|---|---|---|
| CodeGraph CLI 版本 | 1.6.2 | `codegraph version` `[已确认]` |
| 索引规模 | 145 文件 / 2,364 节点 / 5,220 边 / 6.21 MB | `codegraph status` → 末行 `✓ Index is up to date` `[已确认]` |
| 语言分布 | tsx 74 / typescript 69 / javascript 2 | `codegraph status` 输出 `[已确认]` |
| MCP 通道 | 可用，工具全名 `mcp_codegraph_codegraph_explore` | 本轮 3 次调用均返回真实结果 `[已确认]` |
| 工作区状态 | 仅 `?? Project/public/750x750png`（派单前既有残留）+ 本文件 | `git status --porcelain=v1` `[已确认]` |
| 自动化测试 | 0 个（无 `*.test.*` / `*.spec.*`） | `find Project -name "*.test.*" -not -path "*/node_modules/*"` → 空 `[已确认]` |

---

## 1. 入口清单

### 1.1 汇总

| 类型 | 数量 | 证据 |
|---|---|---|
| 启动（命令 / 配置 / 拦截器） | 3 | `Project/package.json:6-10`、`Project/next.config.js`、`Project/middleware.ts:20` `[已确认]` |
| 页面路由（page.tsx） | 23 | `find Project/app -name 'page.tsx'`（计数 23）`[已确认]` |
| 布局（layout.tsx） | 2 | `find Project/app -name 'layout.tsx'`（计数 2）`[已确认]` |
| API 路由（route.ts） | 30 | `find Project/app -name 'route.ts'`（计数 30）`[已确认]` |
| 事件队列 | 0（无） | 无消息中间件（无 Kafka / RabbitMQ / BullMQ / SQS / worker 进程）。唯一含 `queue` 的是 `Project/lib/amap.ts:79` 的进程内串行队列 `amapQueue`（用于高德 QPS 限速），**不是事件队列** `[已确认]` |
| 定时任务 | 0（无） | 无 `vercel.json`、无 cron 配置；仅有**前端** `setInterval` 轮询（非服务端定时任务）`[已确认]` |
| CLI | 0（无） | `Project` 下无 `bin/`、无 `*.mjs`/`*.sh` 自定义脚本 `[已确认]` |
| **合计（页面 + 布局 + API）** | **55** | 23 + 2 + 30 = 55，与阶段 1 审计口径一致 `[已确认]` |

> 另有 `Project/app/not-found.tsx`（1 个）与 8 个 `Project/app/admin/*/loading.tsx`，属框架约定的辅助文件，不计入 55 个入口。`[已确认]`

### 1.2 启动 / 配置 / 拦截器

| 类型 | 入口 | 文件:行 | 说明 |
|---|---|---|---|
| 启动 | `npm run dev` → `next dev` | `Project/package.json:6` | 开发服务器，端口 3000，依赖 `Project/.env.local`。另有 `build`(7) / `start`(8) / `lint`(9) / `typecheck`(10) `[已确认]` |
| 启动 | `next.config.js` | `Project/next.config.js` | 构建配置（阶段 3 需逐项确认，本轮未读全文）`[未知]` |
| 启动 | `middleware()` + `config.matcher` | `Project/middleware.ts:20` / `:56` | 全局鉴权/重定向入口，所有非静态资源请求都会经过 `[已确认]` |

### 1.3 页面路由（23 个）

| 类型 | 入口 | 文件:行 | 说明 |
|---|---|---|---|
| 页面路由 | `/` 首页 | `Project/app/(user)/page.tsx:12` | 用户端首页 `[已确认]` |
| 页面路由 | `/city` 选择城市 | `Project/app/(user)/city/page.tsx:36` | 服务端组件，直接查 `cities` 表；游客态热门城市徽章判定 `[已确认]` |
| 页面路由 | `/routes` 我的路线 | `Project/app/(user)/routes/page.tsx:16` | 受 `PROTECTED_ROUTES` 保护 `[已确认]` |
| 页面路由 | `/collected` 收藏夹 | `Project/app/(user)/collected/page.tsx:20` | 受保护 `[已确认]` |
| 页面路由 | `/profile` 个人中心 | `Project/app/(user)/profile/page.tsx:39` | 受保护；渲染 `MemberCard` 权益卡 `[已确认]` |
| 页面路由 | `/route/new` 新建路线 | `Project/app/(user)/route/new/page.tsx:7` | `[已确认]` |
| 页面路由 | `/route/[id]` 路线详情 | `Project/app/(user)/route/[id]/page.tsx:14` | 动态段 `[id]` `[已确认]` |
| 页面路由 | `/route/[id]/places` 勾选地点 | `Project/app/(user)/route/[id]/places/page.tsx:13` | 动态段 `[已确认]` |
| 页面路由 | `/route/[id]/add` 加地点 | `Project/app/(user)/route/[id]/add/page.tsx:13` | 动态段 `[已确认]` |
| 页面路由 | `/route/[id]/edit` 编辑路线 | `Project/app/(user)/route/[id]/edit/page.tsx:14` | 动态段 `[已确认]` |
| 页面路由 | `/try/new` 游客第 1 步 | `Project/app/(user)/try/new/page.tsx:9` | `GUEST_TRY_ROUTES` 免登录；服务端查 `cities`，`?city=` 承接选址 `[已确认]` |
| 页面路由 | `/try/pick` 游客第 2 步 | `Project/app/(user)/try/pick/page.tsx:7` | 免登录；纯客户端组件 `[已确认]` |
| 页面路由 | `/try/result` 游客第 3 步 | `Project/app/(user)/try/result/page.tsx:9` | 免登录；地图 + 排序 + 保存入口 `[已确认]` |
| 页面路由 | `/login` 登录注册 | `Project/app/(auth)/login/page.tsx:8` | `(auth)` 路由组，无独立 layout `[已确认]` |
| 页面路由 | `/share/[token]` 分享页 | `Project/app/share/[token]/page.tsx:16` | 动态段；`service_role` 读快照，无地图调用 `[已确认]` |
| 页面路由 | `/admin` 后台首页 | `Project/app/admin/page.tsx:48` | 后台看板 `[已确认]` |
| 页面路由 | `/admin/login` 管理员登录 | `Project/app/admin/login/page.tsx:8` | 免鉴权放行 `[已确认]` |
| 页面路由 | `/admin/users` 用户管理 | `Project/app/admin/users/page.tsx:17` | `[已确认]` |
| 页面路由 | `/admin/places` 地点管理 | `Project/app/admin/places/page.tsx:13` | `[已确认]` |
| 页面路由 | `/admin/routes` 路线管理 | `Project/app/admin/routes/page.tsx:17` | `[已确认]` |
| 页面路由 | `/admin/imports` 导入管理 | `Project/app/admin/imports/page.tsx:12` | `[已确认]` |
| 页面路由 | `/admin/orders` 会员订单 | `Project/app/admin/orders/page.tsx:13` | 服务端组件直接查 `member_orders`（见 §4 跨层直连）`[已确认]` |
| 页面路由 | `/admin/online` 在线与用量 | `Project/app/admin/online/page.tsx:35` | 高德用量看板 `[已确认]` |

### 1.4 布局（2 个）

| 类型 | 入口 | 文件:行 | 说明 |
|---|---|---|---|
| 页面路由（布局） | 根布局 | `Project/app/layout.tsx:11` | `<html lang="zh-CN">` + `PRODUCT.NAME` metadata `[已确认]` |
| 页面路由（布局） | 用户端外壳 | `Project/app/(user)/layout.tsx:13` | 服务端读当前用户 → `Header` + `HeartbeatProvider` + `MobileNav`；**不做重定向**，权限归 `middleware.ts` `[已确认]` |

### 1.5 API 路由（30 个）

| 类型 | 入口 | 文件:行 | 说明 |
|---|---|---|---|
| API 路由 | `POST /api/auth/login` | `Project/app/api/auth/login/route.ts:16` | `signInWithPassword`（`:38`）+ 读 `users`（`:68`）`[已确认]` |
| API 路由 | `POST /api/auth/logout` | `Project/app/api/auth/logout/route.ts:7` | `signOut()`（`:9`）`[已确认]` |
| API 路由 | `POST /api/auth/register` | `Project/app/api/auth/register/route.ts:20` | 注册 `[已确认]` |
| API 路由 | `POST /api/auth/reset-password` | `Project/app/api/auth/reset-password/route.ts:60` | 直改密码 + 企业微信提醒 `[已确认]` |
| API 路由 | `POST /api/heartbeat` | `Project/app/api/heartbeat/route.ts:5` | 在线心跳 `[已确认]` |
| API 路由 | `GET /api/try/city-places` | `Project/app/api/try/city-places/route.ts:33` | 游客只读桶，`service_role` 跨用户读 `places` `[已确认]` |
| API 路由 | `POST /api/try/extract` | `Project/app/api/try/extract/route.ts:47` | 游客文案提取（DeepSeek + 高德搜索）`[已确认]` |
| API 路由 | `POST /api/try/order` | `Project/app/api/try/order/route.ts:88` | 游客排路线（`order` / `reorder` 双桶）`[已确认]` |
| API 路由 | `POST /api/try/promote` | `Project/app/api/try/promote/route.ts:54` | 草稿转正落库 `[已确认]` |
| API 路由 | `POST /api/ai/extract` | `Project/app/api/ai/extract/route.ts:29` | 登录用户文案提取（含配额）`[已确认]` |
| API 路由 | `POST /api/places` | `Project/app/api/places/route.ts:88` | 导入地点/收藏落库 `[已确认]` |
| API 路由 | `POST /api/collected` / `DELETE` | `Project/app/api/collected/route.ts:14` / `:43` | 收藏增删（双方法）`[已确认]` |
| API 路由 | `POST /api/routes` | `Project/app/api/routes/route.ts:24` | 新建路线 `[已确认]` |
| API 路由 | `PATCH /api/routes/[id]` | `Project/app/api/routes/[id]/route.ts:10` | 改路线 `[已确认]` |
| API 路由 | `PUT /api/routes/[id]/places` | `Project/app/api/routes/[id]/places/route.ts:26` | 保存地点顺序 `[已确认]` |
| API 路由 | `POST/DELETE /api/routes/[id]/share` | `Project/app/api/routes/[id]/share/route.ts:40` / `:104` | 生成/撤销分享令牌 `[已确认]` |
| API 路由 | `POST /api/shares/[token]/import` | `Project/app/api/shares/[token]/import/route.ts:16` | 分享路线导入 `[已确认]` |
| API 路由 | `POST /api/amap/order` | `Project/app/api/amap/order/route.ts:21` | 登录用户按矩阵重排 `[已确认]` |
| API 路由 | `POST /api/amap/route` | `Project/app/api/amap/route/route.ts:52` | 分段算路 `[已确认]` |
| API 路由 | `POST /api/amap/search` | `Project/app/api/amap/search/route.ts:9` | POI 文本搜索 `[已确认]` |
| API 路由 | `POST /api/amap/landmarks` | `Project/app/api/amap/landmarks/route.ts:27` | 周边知名地点（懒加载）`[已确认]` |
| API 路由 | `POST /api/member` | `Project/app/api/member/route.ts:18` | 会员开通（后台调用）`[已确认]` |
| API 路由 | `POST/GET /api/member/orders` | `Project/app/api/member/orders/route.ts:28` / `:108` | 提交订单 / 我的订单 `[已确认]` |
| API 路由 | `GET /api/member/orders/status` | `Project/app/api/member/orders/status/route.ts:24` | 轮询核销结果 `[已确认]` |
| API 路由 | `GET /api/admin/member/orders` | `Project/app/api/admin/member/orders/route.ts:14` | 后台订单列表 `[已确认]` |
| API 路由 | `POST /api/admin/member/orders/[id]` | `Project/app/api/admin/member/orders/[id]/route.ts:21` | 人工核销 `[已确认]` |
| API 路由 | `GET /api/admin/member/orders/pending-count` | `Project/app/api/admin/member/orders/pending-count/route.ts:15` | 侧边栏角标数 `[已确认]` |
| API 路由 | `POST /api/admin/member` | `Project/app/api/admin/member/route.ts:13` | 后台直接授予会员 `[已确认]` |
| API 路由 | `DELETE /api/admin/users/[id]` | `Project/app/api/admin/users/[id]/route.ts:14` | 删除用户 `[已确认]` |
| API 路由 | `POST /api/admin/seed-demo` | `Project/app/api/admin/seed-demo/route.ts:77` | 示例数据补充（含分页防截断）`[已确认]` |

### 1.6 无事件队列 / 无定时任务 / 无 CLI（明确结论）

| 类型 | 结论 | 证据 |
|---|---|---|
| 事件队列 | **无** | 全仓无 Kafka/RabbitMQ/Bull/SQS 等引用；无 worker 进程 `[已确认]` |
| 定时任务 | **无服务端定时任务** | 无 `vercel.json`；全部 `setInterval` 均为**浏览器端轮询**：`Project/lib/heartbeat.ts:45`（心跳）、`Project/lib/amap.ts:353`（用量落库 flush）、`Project/components/layout/AdminShell.tsx:71`（待核销角标）、`AdminShell.tsx:99`（在线刷新）、`Project/components/profile/MemberCard.tsx:155`（核销轮询）`[已确认]` |
| CLI | **无** | `Project` 下没有 `bin/`、自定义 `*.mjs`/`*.sh`；`package.json` 只有 next 的 5 个脚本 `[已确认]` |

> `[风险]` 会员到期回落、高德用量熔断、心跳在线状态全部依赖「请求时惰性计算 / 浏览器轮询」，没有服务端定时任务兜底。若用户长期不开页面，`member` 字段与 `amap_usage` 不会自动清算（到期判定本身在读取时正确，但**存储值不会自动翻转**）。

---

## 2. 目录与模块职责

| 目录/模块 | 职责 | 关键文件 | 对外暴露 | 不应负责什么 |
|---|---|---|---|---|
| `Project/app` | App Router 路由层：页面编排（Server Component 取数）+ 30 个 API 端点 | `app/(user)/*`、`app/admin/*`、`app/api/**/route.ts`、`app/layout.tsx`、`app/(user)/layout.tsx` | 23 个页面、2 个布局、30 个 `GET/POST/PUT/PATCH/DELETE` 端点 `[已确认]` | 不应承载业务规则（距离矩阵、配额算法）与第三方调用细节；但**当前存在页面直接查库**（见 §4）`[已确认]` |
| `Project/components` | 客户端交互组件：地图、拖拽排序、表单、后台表格、布局外壳 | `components/route/RouteResultClient.tsx`(1930 行)、`components/try/TryResultClient.tsx`(736)、`components/route/RoutePlacesClient.tsx`(526)、`components/try/TryPickClient.tsx`(572)、`components/layout/*` | 各页面导入的 `*Client` 组件与少量纯展示组件 `[已确认]` | **不得直接访问数据库 / `lib/supabase`**（实测 `grep -rn "lib/supabase" Project/components` → 无匹配，约束当前成立）`[已确认]` |
| `Project/lib` | 领域服务层：高德、DeepSeek、配额、排序、分享、海报、草稿、限流、通知 | `lib/amap.ts`(814)、`lib/member-quota.ts`(304)、`lib/route-order.ts`(224)、`lib/order-notify.ts`(190)、`lib/route-share.ts`(159)、`lib/guest-rate-limit.ts`(134) | 见 §2.1 导出清单 `[已确认]` | 不应处理 HTTP 请求/响应、不应读写 sessionStorage、不应做 UI 文案拼装（文案在 `config/messages.ts`） |
| `Project/config` | 全局常量单一来源：配额、业务参数、枚举、文案、路由常量、环境变量 | `config/business.ts`(190，被 54 文件引用)、`config/enums.ts`(276，被 57)、`config/messages.ts`(1685，被 91)、`config/routes.ts`(73，被 53)、`config/env.ts`(94，被 10)、`config/product.ts`(86，被 15)、`config/cities.ts`(396，被 3) | `BUSINESS` / `ENUMS` / `MESSAGES` / `ROUTES` / `ENV` / `PRODUCT` `[已确认]` | 不应包含运行时副作用（`env.ts` 只做 `process.env` 静态读取与数组组装）`[已确认]` |
| `Project/types` | 纯类型定义（302 行，7 文件） | `types/user.ts`(83)、`types/route.ts`(105)、`types/place.ts`(46)、`types/index.ts`(30)、`types/import.ts`(17)、`types/event.ts`(13)、`types/city.ts`(8) | 全部 `type` / `interface`，零运行时代码 `[已确认]` | 不应包含校验函数或常量 |
| `Project/lib/supabase` | Supabase 客户端工厂（4 种运行环境） | `admin.ts`(`createAdminClient`:9)、`server.ts`(28 注入 `noStoreFetch`)、`client.ts`(浏览器)、`middleware.ts`(`updateSession`:12)、`fetch.ts`(`noStoreFetch`:22) | 4 个工厂函数 + `noStoreFetch` `[已确认]` | 不应写业务查询；`admin.ts` 用 `service_role`，**绕 RLS**，只能服务端引入 `[风险]` |
| `Project/supabase` | 数据库迁移（25 份 / 2,972 行）与 RLS、触发器、种子数据 | `migrations/001_create_users.sql` ~ `025_route_monthly_quota.sql` | 无（只被 Supabase 执行）`[已确认]` | 不应包含应用运行时代码 |
| `Project/middleware.ts` | 唯一鉴权拦截点 | `middleware.ts:20` | Next.js `middleware` 约定导出 `[已确认]` | 不应写业务逻辑：只做登录态判断 + 管理员角色校验 + 重定向 |

### 2.1 `lib` 导出清单（阶段 3 起改动前必查）

| 文件 | 行数 | 关键导出（含行号） |
|---|---|---|
| `lib/amap.ts` | 814 | `AmapError`:13、`AmapLeg`:23、`AmapDayRoute`:28、`toAmapLocation`:48、`planLeg`:502、`planDayRoute`:532、`distanceMatrix`:576、`cachedDistanceMatrix`:650、`searchLandmarks`:683、`resolveLodgingCoords`:752、`searchPlaces`:778 `[已确认]` |
| `lib/member-quota.ts` | 304 | `tierOf`:64、`isMemberActive`:78、`limitsOf`:90、`getQuotaProfile`:110、`getDailyUsage`:205、`bumpDailyUsage`:210、`routeBucket`:215、`getRouteQuota`:234、`consumeRouteQuota`:257、`markTrialMultiDayUsed`:280、`buildStraightMatrix`:294 `[已确认]` |
| `lib/route-order.ts` | 224 | `straightDist2`:38、`orderByStraightLine`:83、`orderByMatrix`:173、`distributeByDays`:197 `[已确认]` |
| `lib/guest-rate-limit.ts` | 134 | `GUEST_COOKIE`:20、`localDayString`:37、`isPrivateOrLoopbackIp`:55、`resolveGuestKey`:69、`guestCookieOptions`:83、`dailyLimitOf`:99、`checkGuestRateLimit`:109 `[已确认]` |
| `lib/order-notify.ts` | 190 | `notifyNewMemberOrder`:174、`notifyPasswordReset`:186 `[已确认]` |
| `lib/route-share.ts` | 159 | `generateShareToken`:25、`buildIntercityLabel`:30、`buildLodgingLabel`:47、`buildRouteSnapshot`:69 `[已确认]` |
| `lib/route-poster.ts` | 256 | `renderRoutePoster`:99 `[已确认]` |
| `lib/amap-usage.ts` | 202 | `getAmapUsage`:165、`getExhaustedWebKeySlots`:182、`isAmapQuotaCritical`:195 `[已确认]` |
| `lib/amap-key-pool.ts` | — | `webKeyLabel`:15、`pickWebKeySlot`:34、`webKeyAt`:52 `[已确认]` |
| `lib/route-settings.ts` | 107 | `nullableText`:32、`parseTripSettings`:37 `[已确认]` |
| `lib/draft.ts` | 112 | `readDraft`:18、`saveDraft`:28、`clearDraft`:37、`readTryDraft`:87、`saveTryDraft`:97、`clearTryDraft`:106 `[已确认]` |
| `lib/deepseek.ts` | 93 | `extractPlacesAndCity`:57 `[已确认]` |
| `lib/link-fetch.ts` | 186 | `firstUrlIn`:24、`textWithoutUrls`:30、`isUrlOnly`:34、`fetchTextFromUrl`:145 `[已确认]` |
| `lib/amap-loader.ts` | — | `loadAmap`:53 `[已确认]` |
| `lib/amap-uri.ts` | — | `detectAmapPlatform`:36、`buildAmapAppUri`:52 `[已确认]` |
| `lib/events.ts` | — | `trackEvent`:7 `[已确认]` |
| `lib/heartbeat.ts` | — | `startHeartbeat`:35 `[已确认]` |

### 2.2 数据表（按迁移文件名推断）

`users`、`cities`、`places`、`routes`、`route_places`、`imports`、`events`（001–007）＋ 后续迁移增补的 `member_orders`、`member_logs`、`route_shares`、`amap_leg_cache`、`amap_geocode_cache`、`amap_usage`、用量日表 等 `[高度可能]`（依据迁移文件名与源码中 `.from('...')` 调用互证；本轮未直接读库）

触发器 4 个（`grep -rhno "create trigger [a-z_]*" Project/supabase/migrations`）：`on_auth_user_created`、`users_prevent_member_self_grant`、`users_prevent_role_change`、`users_admin_default_member` `[已确认]`

---

## 3. 关键业务调用链

> 表示法：**调用方 → 路由 → 服务 → 数据访问 → 数据库/外部服务**
> 每条链后附「未覆盖的分支」。

### 3.1 链路 ①：游客试用生成路线（三日程免登录）

**概述**：`/city` 选城市 → `/try/new` 设置路线 → `/try/pick` 勾选库内地点（`/api/try/city-places`）→ `/try/result` 调 `/api/try/order` → 高德距离矩阵 → 最近邻 + 2-opt → 逐段算路 → 分段里程。

| 跳 | 符号 | 文件:行 | 证据 |
|---|---|---|---|
| 1 | `TryPickClient`（组件挂载后取库内地点） | `Project/components/try/TryPickClient.tsx:121` | `grep -n "api/try/city-places"` → 命中 `fetch(\`/api/try/city-places?cityId=...\`)` **CLI 关键词检索** `[已确认]` |
| 2 | `GET` 处理函数 | `Project/app/api/try/city-places/route.ts:33` | 入口清单实测 `[已确认]` |
| 3 | `resolveGuestKey` | `Project/lib/guest-rate-limit.ts:69` | **MCP** `explore("checkGuestRateLimit dailyLimitOf resolveGuestKey GUEST_COOKIE")` → `resolveGuestKey (lib/guest-rate-limit.ts:69) — 8 callers` `[已确认]` |
| 4 | `checkGuestRateLimit(key,'city-places')` | `Project/lib/guest-rate-limit.ts:109`；`dailyLimitOf`:99 | **CLI** `codegraph callers checkGuestRateLimit` → 8 callers，含 `GET app/api/try/city-places/route.ts:33`、`POST app/api/try/order/route.ts:88`、`POST app/api/ai/extract/route.ts:29`、`POST app/api/try/extract/route.ts:47` `[已确认]` |
| 5 | 服务端跨用户读 `places`（`service_role`） | `Project/app/api/try/city-places/route.ts`（`createAdminClient` 引入） | `grep -rln createAdminClient` 命中该文件 `[已确认]` |
| 6 | `TryResultClient` 触发排路线 | `Project/components/try/TryResultClient.tsx:307`、`:391` | `grep -n "api/try/order"` → 两处 `fetch` `[已确认]` |
| 7 | `POST` 处理函数 | `Project/app/api/try/order/route.ts:88` | 入口清单实测 `[已确认]` |
| 8 | `checkGuestRateLimit(key, manual ? 'reorder' : 'order')` | `Project/app/api/try/order/route.ts:106` | `grep -n "checkGuestRateLimit"` → `106` `[已确认]` |
| 9 | `cachedDistanceMatrix(allPoints, mode)` | 调用点 `route.ts:179`；定义 `Project/lib/amap.ts:650` | `grep -n` 命中；**MCP** `explore("POST /api/try/order ... cachedDistanceMatrix orderByMatrix estimateLeg")` 返回 `lib/amap.ts:650` 源码 `[已确认]` |
| 10 | `distanceMatrix`（进程内 10 分钟矩阵缓存 → 落库缓存 → 高德） | `Project/lib/amap.ts:576`；`readLegCache`:203；`writeLegCache`:246 | 读 `lib/amap.ts:203-250` 与 `:576-657` 原文 `[已确认]` |
| 11 | `amapGet('/v3/distance', …)` | `Project/lib/amap.ts:607`（`amapGet` 定义 `:130`） | 原文 `[已确认]` |
| 12 | `orderByMatrix(...)` 最近邻 + 2-opt | 调用点 `route.ts:179`；定义 `Project/lib/route-order.ts:173` | **CLI** `codegraph callers orderByMatrix` → 6 callers（`amap/route:52`、`try/order:88`、`amap/order:21` + 3 import 边）`[已确认]` |
| 13 | `planDayRoute(orderedPoints, mode, cityAdcode)` → `planLeg` 逐段 | 调用点 `route.ts:192`；定义 `Project/lib/amap.ts:532` / `planLeg`:502 | **CLI** `codegraph callers planDayRoute` → 2（定义处 + `POST try/order:88`）`[已确认]` |
| 14 | 高德 Web 服务 `/v3/direction` | `Project/lib/amap.ts`（`planLeg` 内 `amapGet`） | 读原文 `[已确认]` |
| 15 | 失败兜底 `estimateLeg`（直线 ×1.3 + 方式速度） | `Project/app/api/try/order/route.ts:64`，调用点 `:209` | `grep -n` 命中 `64/209`；**MCP** explore 返回该函数原文 `[已确认]` |
| 16 | 住宿点解析 `resolveLodgingCoords` | `Project/lib/amap.ts:752` | **CLI** `codegraph callers resolveLodgingCoords` → 6（`RouteDetailPage`、`POST try/order:88`、`RoutePlacesPage` 等）`[已确认]` |

**未覆盖的分支**：
- `manual=true`（用户手动拖动顺序）走 `reorder` 桶并**跳过**距离矩阵（`route.ts:102-106` 注释与代码）→ 本链路只覆盖首次生成 `[已确认]`
- 高德 Key 全部达 95% 熔断时的**整体降级为直线估算**分支（`lib/amap-usage.ts:182 getExhaustedWebKeySlots`）未在链上取到调用点行号 `[未知]`
- 池内单 Key 轮询切换（`lib/amap-key-pool.ts:34 pickWebKeySlot`）的实际分支路径未逐行确认 `[未知]`
- `cityAdcode` 为空时的算路行为 `[未知]`

### 3.2 链路 ②：保存路线（游客草稿转正落库）

**概述**：`/try/result` → `/api/try/promote` → 档位校验 → `places` / `routes` / `route_places` 三表写入 → 扣月度路线配额。

| 跳 | 符号 | 文件:行 | 证据 |
|---|---|---|---|
| 1 | `TryResultClient` 保存按钮 | `Project/components/try/TryResultClient.tsx:480` | `grep -n "api/try/promote"` → 命中 `:480` `[已确认]` |
| 2 | `POST` 处理函数 | `Project/app/api/try/promote/route.ts:54` | 入口清单实测 `[已确认]` |
| 3 | `limitsOf(tier)` 取档位上限 | 调用点 `promote/route.ts:154`；定义 `Project/lib/member-quota.ts:90` | **CLI** `codegraph callers limitsOf` → 14 callers，含 `try/promote:54`、`ai/extract:29`、`routes/[id]/places:26`、`routes:24`、`collected:43` `[已确认]` |
| 4 | `keyOf` 去重键 | `Project/app/api/try/promote/route.ts:183` | `grep -n` 命中 `[已确认]` |
| 5 | `places.insert` | `Project/app/api/try/promote/route.ts:201` | `grep -n` 命中 `[已确认]` |
| 6 | 失败回滚 `rollbackPlaces` | `Project/app/api/try/promote/route.ts:176` | `grep -n` 命中 `[已确认]` |
| 7 | `routes.insert` | `Project/app/api/try/promote/route.ts:229` | `grep -n` 命中 `[已确认]` |
| 8 | `route_places.insert` | `Project/app/api/try/promote/route.ts:253` | `grep -n` 命中 `[已确认]` |
| 9 | `consumeRouteQuota(user.id, tier)` | 调用点 `promote/route.ts:263`；定义 `Project/lib/member-quota.ts:257` | **CLI** `codegraph callers consumeRouteQuota` → 6（`try/promote:54`、`routes:24`、`shares/[token]/import:16` 等）`[已确认]` |
| 10 | 配额落库 `usage_daily` 类表（`bumpDailyUsage`:210） | `Project/lib/member-quota.ts:210` | 读导出清单 `[已确认]` |

**未覆盖的分支**：
- 未登录 401 分支（本链路前置已登录，页面对游客先跳 `/login?redirect=/try/result`）`[高度可能]`
- 配额超限的错误码（`routeQuotaErrorBody`:267）与前端提示的对应关系未逐行核对 `[未知]`
- `rollbackPlaces` 自身失败（二次异常）时的残留数据行为 `[未知]`
- 管理员（不限配额）走同一路径时的分支差异 `[未知]`

### 3.3 链路 ③：会员订单开通（下单 → 企业微信提醒 → 人工核销 → 轮询生效）

**概述**：`MemberCard` → `POST /api/member/orders` → `member_orders` 落库 + 企业微信 Webhook；管理员后台角标轮询 → `POST /api/admin/member/orders/[id]` → `users.member_until` 生效 + `member_logs` 留痕 + 订单状态 APPROVED；用户端 `GET /api/member/orders/status` 轮询 → 关闭扫码页。

| 跳 | 符号 | 文件:行 | 证据 |
|---|---|---|---|
| 1 | `MemberCard` 提交订单 | `Project/components/profile/MemberCard.tsx:121` | `grep -n "api/member/orders"` → 命中 `:121` `[已确认]` |
| 2 | `POST` 处理函数 | `Project/app/api/member/orders/route.ts:28` | 入口清单实测 `[已确认]` |
| 3 | 待核销笔数上限校验（`MAX_PENDING_ORDERS`） | `Project/app/api/member/orders/route.ts:66-71` | 读原文 `[已确认]` |
| 4 | `member_orders.insert` | `Project/app/api/member/orders/route.ts:75-76` | 读原文 `[已确认]` |
| 5 | `notifyNewMemberOrder({...})` | 调用点 `member/orders/route.ts:92`；定义 `Project/lib/order-notify.ts:174` | `grep -n` 命中 `[已确认]` |
| 6 | 企业微信群机器人 Webhook | `Project/lib/order-notify.ts:73`（`ENV.ORDER_NOTIFY_WECOM_WEBHOOK`）、任务聚合 `:166-167` | 读原文 `[已确认]` |
| 7 | （可选）企业微信自建应用 `gettoken` | `Project/lib/order-notify.ts:100`、`agentid` `:143` | 需 `WECOM_CORP_ID/SECRET/AGENT_ID` 三项齐全才启用 `:167` `[已确认]` |
| 8 | 后台角标轮询 | `Project/components/layout/AdminShell.tsx:71` → `GET /api/admin/member/orders/pending-count` `route.ts:15` | `grep -n setInterval` 命中 `[已确认]` |
| 9 | 管理员核销 `POST` | `Project/app/api/admin/member/orders/[id]/route.ts:21` | 入口清单实测 `[已确认]` |
| 10 | 订单存在性 + `PENDING` 状态校验 | `Project/app/api/admin/member/orders/[id]/route.ts:54`、`:61` | `grep -n` 命中 `[已确认]` |
| 11 | `users.update({ member, member_since, member_source, member_until })` | `Project/app/api/admin/member/orders/[id]/route.ts:88-94` | 读原文 `[已确认]` |
| 12 | `member_logs.insert`（service_role，无 insert 策略） | `Project/app/api/admin/member/orders/[id]/route.ts:101` | 读原文 `[已确认]` |
| 13 | `member_orders.update({ status: APPROVED })` | `Project/app/api/admin/member/orders/[id]/route.ts:109-111` | 读原文 `[已确认]` |
| 14 | 用户端轮询 | `Project/components/profile/MemberCard.tsx:162` → `GET /api/member/orders/status` `route.ts:24` | `grep -n` 命中 `[已确认]` |
| 15 | `isMemberActive(member, member_until)` 惰性到期判定 | `Project/app/api/member/orders/status/route.ts:18` 定义 / `:52` 调用 | 读原文 `[已确认]` |

**未覆盖的分支**：
- 驳回分支（`approve !== true`）的具体字段与前端展示 `[未知]`
- 管理员「直接授予会员」旁路 `/api/admin/member`（`route.ts:13`）不在本链路内 `[已确认]`
- 企业微信 Webhook **发送失败**时的降级路径（代码注释称「失败不影响下单结果」）`[高度可能]`
- `pay_channel` 双通道（微信/支付宝）在核销时的对账逻辑 `[未知]`

### 3.4 链路 ④：登录 / 鉴权

**概述**：`LoginClient` → `POST /api/auth/login` → Supabase Auth `signInWithPassword` → Set-Cookie；此后每次请求经 `middleware` → `updateSession` → `supabase.auth.getUser` → 按 `PROTECTED_ROUTES` / `ADMIN_ROUTES` 决定放行或重定向。

| 跳 | 符号 | 文件:行 | 证据 |
|---|---|---|---|
| 1 | `LoginClient` 提交 | `Project/components/auth/LoginClient.tsx:81` | `grep -n "api/auth/"` → 命中 `:81` `[已确认]` |
| 2 | `POST` 处理函数 | `Project/app/api/auth/login/route.ts:16` | 入口清单实测 `[已确认]` |
| 3 | `supabase.auth.signInWithPassword` | `Project/app/api/auth/login/route.ts:38` | `grep -n` 命中 `[已确认]` |
| 4 | 读 `users`（角色/昵称） | `Project/app/api/auth/login/route.ts:68` | `grep -n` 命中 `[已确认]` |
| 5 | `middleware(request)` | `Project/middleware.ts:20` | 读全文 `[已确认]` |
| 6 | `updateSession(request)` | `Project/lib/supabase/middleware.ts:12` | **CLI** `codegraph callers updateSession` → 2（定义 + `middleware.ts:20`）`[已确认]` |
| 7 | `supabase.auth.getUser()`（解析 cookie 会话） | `Project/lib/supabase/middleware.ts:34` | `grep -n` 命中 `[已确认]` |
| 8 | 管理员角色校验：`from('users').select('role')` | `Project/middleware.ts:40`；拒绝分支 `:41-42` | 读原文 `[已确认]` |
| 9 | 路由分类放行/重定向：登录页 `:25-26`、`/try/*` 公开 `:30-31`、管理员 `:35-45`、受保护页 `:49-50` | `Project/middleware.ts:25-50`；常量 `Project/config/routes.ts:56`(PROTECTED) / `:62`(GUEST_TRY) / `:65`(ADMIN) | 读原文 `[已确认]` |
| 10 | 退出登录 | `Project/components/profile/ProfileMenu.tsx:22` → `POST /api/auth/logout` `route.ts:7` → `signOut()` `:9` | `grep -n` 命中 `[已确认]` |

**未覆盖的分支**：
- `matcher` 排除静态资源后的**真实生效范围**属框架约定，静态分析看不到运行时匹配结果 `[未知]`
- cookie 中的 `sb-*-auth-token` 为二进制压缩态，`getUser()` 的解码细节在 `@supabase/ssr` 内部 `[未知]`
- 忘记密码链路（`/api/auth/reset-password` `:60` + 管理员禁改 + IP 限流）不在本链路内，但同属鉴权域 `[已确认]`
- 会员到期「惰性回落」在 `middleware` 中**不参与**判定（仅 `role`），权限回落发生在各接口的 `tierOf/isMemberActive` `[已确认]`

---

## 4. 依赖异常与高风险模块

### 4.1 跨层直连（有证据）

| 结论 | 证据 | 判定 |
|---|---|---|
| `components` **不直连数据库**（约束成立） | `grep -rn "lib/supabase" Project/components` → `(none)` | `[已确认]` |
| 但有 **3 个 Server Component 页面绕过 API 层直接查库**（用 `service_role`，绕 RLS） | `createAdminClient` 命中：`Project/app/admin/orders/page.tsx:8`（调用 `:14`）、`Project/app/(user)/city/page.tsx:3`（`:14`）、`Project/app/share/[token]/page.tsx:8`（`:20`、`:54`） | `[已确认]` `[风险]`：页面级取数少了 API 的入参校验与错误码约定，改表结构时要同时改页面 |
| `lib` 内部也直连数据库 | `lib/route-share.ts`、`lib/amap.ts`、`lib/member-quota.ts`、`lib/amap-usage.ts` 均 `createAdminClient` | `[已确认]`：lib 兼具「服务层 + 数据访问层」两种职责 |

### 4.2 循环依赖

| 结论 | 证据 | 判定 |
|---|---|---|
| `lib` 内部**未发现循环依赖** | `grep -n "^import" Project/lib/*.ts`：`route-order.ts` **零** `@/lib` 导入；`member-quota.ts:6 → route-order`（单向）；`amap.ts:5,6 → amap-key-pool / amap-usage`（单向）；`amap-usage.ts:3 → supabase/admin`（单向） | `[已确认]` |
| `amap.ts` 同时依赖 `amap-key-pool` 与 `amap-usage`，两者互不依赖 | 同上 | `[已确认]` |
| 是否存在运行期间接环（经 `config/env` → `lib`） | `config/*` 无 `@/lib` 导入（`env.ts` 仅读 `process.env`） | `[已确认]` 无环 |

### 4.3 重复实现（7 组，均有行号）

| 重复符号 | 位置 1 | 位置 2 | 位置 3 | 风险 |
|---|---|---|---|---|
| `straightMeters` | `Project/app/api/amap/route/route.ts:29` | `Project/app/api/try/order/route.ts:50` | — | `[风险]` 两份哈弗辛公式，改一处忘另一处会导致两条链路距离口径不一致 |
| `estimateLeg` | `Project/app/api/amap/route/route.ts:43` | `Project/app/api/try/order/route.ts:64` | — | 同上（`×1.3` 兜底系数重复） |
| `SortablePlaceRow` | `Project/components/route/RouteResultClient.tsx:444` | `Project/components/try/TryResultClient.tsx:88` | — | `[风险]` 拖拽排序 UI 两份，L48 教训「游客页与普通页不要各写一套」已在此复现 |
| `localDayString` | `Project/lib/member-quota.ts:148`（export） | `Project/lib/guest-rate-limit.ts:37` | `Project/lib/amap-usage.ts:81` | `[风险]` 三份「服务器本地日」实现，时区口径漂移会同时影响配额、游客限流、高德用量 |
| `isActive`（导航高亮） | `Project/components/layout/MobileNav.tsx:20` | `Project/components/layout/Header.tsx:22` | — | `[高度可能]` 低危 |
| `nullableText` | `Project/app/api/try/promote/route.ts:42` | `Project/lib/route-settings.ts:32` | — | 低危，`[已确认]` |
| `fmtTime` | `Project/components/route/MyRoutesClient.tsx:77` | `Project/components/admin/AdminPlacesClient.tsx:33` | `Project/components/admin/AdminImportsClient.tsx:25`、`Project/components/admin/AdminRoutesClient.tsx:39`、`Project/components/collected/CollectedClient.tsx:54` | `[风险]` 5 份时间格式化，时区/格式改一处会不一致 |

**游客页 / 普通页重复实现（结构级）** `[已确认]`

| 对比项 | `components/try/TryPickClient.tsx`(572) | `components/route/RoutePlacesClient.tsx`(526) |
|---|---|---|
| 内部工具函数 | `filterTabCls`:60、`pickCls`:62、`typeIconCls`:66 | `filterTabCls`:46、`pickCls`:48、`typeIconCls`:52 |
| 主组件 | `TryPickClient`:80 | `RoutePlacesClient`:67 |

两者**同样的三个样式函数各写一份**，主组件也各写一套（未共用）。`[风险]` 这正是 AGENTS.md L48 记录的问题：游客页与普通页各写一套必然分叉。

**两个提取接口高度相似** `[已确认]`

| 接口 | 行数 | 共用依赖 |
|---|---|---|
| `app/api/ai/extract/route.ts`（登录用户） | 131 | `extractPlacesAndCity`、`fetchTextFromUrl`、`firstUrlIn`、`isUrlOnly` |
| `app/api/try/extract/route.ts`（游客） | 157 | 同上 + `searchPlaces` |

差异主要在鉴权与限流桶，正文解析逻辑重复。`[风险]` 改提取规则需同时改两处。

### 4.4 超大函数 / 超大文件

| 文件 | 行数 | 判定 |
|---|---|---|
| `Project/components/route/RouteResultClient.tsx` | 1930 | `[风险]` 单文件含地图、拖拽、弹层、导出、导航全部交互，是当前最大改动风险点 |
| `Project/config/messages.ts` | 1685 | `[风险]` 91 个文件引用；文案改动面极广 |
| `Project/components/route/RouteAddClient.tsx` | 859 | `[风险]` |
| `Project/lib/amap.ts` | 814 | `[风险]` 缓存 + 算路 + Key 池 + 搜索 + 住宿解析全在一个文件 |
| `Project/components/try/TryResultClient.tsx` | 736 | `[风险]` |
| `Project/components/home/ImportCollectClient.tsx` | 601 | 中 |
| `Project/components/try/TryPickClient.tsx` | 572 | 中 |
| `Project/components/route/RouteEditClient.tsx` | 548 | 中 |
| `Project/components/admin/AdminUsersClient.tsx` | 543 | 中 |
| `Project/components/route/RoutePlacesClient.tsx` | 526 | 中 |
| `Project/components/auth/LoginClient.tsx` | 524 | 中 |
| `Project/components/route/TripSettingsFields.tsx` | 513 | 中（游客与普通用户**共用**的裁剪组件，改动需双侧回归） |

### 4.5 影响面样例（真实输出）

**样例 A —— `checkGuestRateLimit`（游客限流核心）**

- 查询来源：**MCP**，工具 `mcp_codegraph_codegraph_explore`
- 原始参数：`query = "checkGuestRateLimit dailyLimitOf resolveGuestKey GUEST_COOKIE"`，`maxFiles = 3`，`projectPath = /Volumes/Programming/Project-File/AI-lvcingyitiaoxian`
- 原始输出（节选，未改写）：

```text
**Exploration: checkGuestRateLimit dailyLimitOf resolveGuestKey GUEST_COOKIE**
Found 23 symbols across 2 files.

**Blast radius — what depends on these (update/verify before editing)**
- `dailyLimitOf` (Project/lib/guest-rate-limit.ts:99) — 1 caller in `Project/lib/guest-rate-limit.ts`; no tests found within 3 caller hops
- `resolveGuestKey` (Project/lib/guest-rate-limit.ts:69) — 8 callers in `Project/app/api/try/city-places/route.ts`, `Project/app/api/try/order/route.ts`, `Project/app/api/ai/extract/route.ts`, `Project/app/api/try/extract/route.ts`; no tests found within 3 caller hops
- `GUEST_COOKIE` (Project/lib/guest-rate-limit.ts:20) — 5 callers ...
- `guestCookieOptions` (Project/lib/guest-rate-limit.ts:83) — 8 callers ...
- `GUEST_COOKIE_MAX_AGE_DAYS` (Project/lib/guest-rate-limit.ts:23) — 1 caller ...
```

- 交叉验证：**CLI** `codegraph callers checkGuestRateLimit`：

```text
Callers of "checkGuestRateLimit" (8):
function checkGuestRateLimit (typescript) — Project/lib/guest-rate-limit.ts:109
function    GET
  Project/app/api/try/city-places/route.ts:33
function    POST
  Project/app/api/try/order/route.ts:88
function    POST
  Project/app/api/ai/extract/route.ts:29
function    POST
  Project/app/api/try/extract/route.ts:47
file        route.ts [imports]   (×4)
```

- 结论：改动 `checkGuestRateLimit` 会同时影响 **4 个免登录接口**（`city-places` / `order` / `ai-extract` / `try-extract`），其中 `ai/extract` 是登录用户接口——**改限流时必须区分调用方是否已登录**，否则可能误伤登录用户。`[已确认]` `[风险]`
- 补充风险：该函数用**进程内 `Map`** 计数（`CLEANUP_THRESHOLD=2000`），`[风险]` 多实例/重启即清零，不是持久化限流。

**样例 B —— `orderByMatrix`（路线排序）**

- 查询来源：**CLI** `codegraph callers orderByMatrix`
- 原始输出：

```text
Callers of "orderByMatrix" (6):
function orderByMatrix (typescript) — Project/lib/route-order.ts:173
function    POST   Project/app/api/amap/route/route.ts:52
function    POST   Project/app/api/try/order/route.ts:88
function    POST   Project/app/api/amap/order/route.ts:21
file        route.ts [imports]   (×3)
```

- 结论：排序算法改动会同时影响 **3 条链路**（游客排路线、登录用户重排、算路接口）。`[已确认]`

**样例 C —— `limitsOf`（档位配额）**

- 查询来源：**CLI** `codegraph callers limitsOf` → **14 个调用方**，含 `app/api/try/promote/route.ts:54`、`app/api/ai/extract/route.ts:29`、`app/api/routes/[id]/places/route.ts:26`、`lib/member-quota.ts:215(routeBucket)`、`app/api/routes/route.ts:24`、`app/api/collected/route.ts:43`、`lib/member-quota.ts:234(getRouteQuota)` 等。`[已确认]`
- 结论：配额口径是**全站最敏感的单点**，改一个数字会同时改变游客试用、路线保存、收藏加路线、文案提取四类行为。`[风险]`

### 4.6 其他高风险模块

| 模块 | 风险 | 证据 | 判定 |
|---|---|---|---|
| `lib/amap.ts` | 缓存失败静默（`readLegCache` catch 后按未命中处理）→ 高德额度会被静默多消耗 | `Project/lib/amap.ts:235-238` | `[已确认]` `[风险]` |
| `lib/supabase/admin.ts` | `service_role` **绕 RLS**；`createAdminClient` 出现在 22 个文件（app 侧 17 + lib 侧 5，其中 1 个是定义文件），含 3 个 Server Component 页面 | `grep -rln 'createAdminClient' Project/app Project/lib`（计数 22）；限定 `Project/app`（计数 17） | `[已确认]` `[风险]`：任何一处把用户输入拼进查询都可能越权 |
| `middleware.ts` | 管理员判定依赖一次 `users.role` 查询，查询失败时 `data?.role !== 'admin'` 会**默认拒绝**（安全方向正确） | `Project/middleware.ts:40-42` | `[已确认]` |
| `config/messages.ts` | 1685 行 / 91 引用，是事实上的「文案总线」 | `grep -rl` 计数 | `[已确认]` `[风险]` |
| `components/route/TripSettingsFields.tsx` | 游客与普通用户共用，靠 `sections` 裁剪；改字段会双端生效 | L48 教训 + `sections` 参数 | `[已确认]` |

---

## 5. 静态分析盲区清单

| # | 盲区 | 说明 | 证据 / 判定 |
|---|---|---|---|
| 1 | **Next.js App Router 约定式路由** | `page.tsx` / `layout.tsx` / `route.ts` / `loading.tsx` / `not-found.tsx` 由目录名自动注册，CodeGraph 只看到「文件在哪个目录」，看不到最终 URL 与路由组 `(user)` / `(auth)` 的折叠规则 | 23+2+30 入口靠 `find` 得到，**非图谱推导** `[已确认]` |
| 2 | **`middleware` 的运行时生效范围** | `config.matcher` 只排除 `_next/static`、`_next/image`、`favicon.ico` 与常见图片后缀，其余全部经过 middleware；真实匹配结果只有运行时才知道 | `Project/middleware.ts:56-58`（`config` 在 `:56`，`matcher` 在 `:57`）`[已确认]` |
| 3 | **Cookie / 会话解码** | `supabase.auth.getUser()` 读取 `sb-*-auth-token`（二进制压缩态），解码逻辑在 `@supabase/ssr` 内部，静态图谱看不到 | `lib/supabase/middleware.ts:34`；教训记录亦印证 `[已确认]` |
| 4 | **第三方脚本动态注入** | 高德 JS API 通过 `document.createElement('script')` + `script.src` 注入（运行时 URL 拼接 `v=1.4.15&key=...`），图谱无节点 | `Project/lib/amap-loader.ts:68-69`、`:86` `[已确认]` |
| 5 | **`process.env` 静态内联** | `config/env.ts` 需逐个静态书写 `process.env.XXX` 才能被打包内联；动态键名拼接不会生效，且 `.env.local` 实际值不参与静态分析 | `config/env.ts:50-85`（`ENV` 定义）`[已确认]` `[风险]` |
| 6 | **RLS / 触发器在数据库侧** | 25 份迁移里的 `create policy`（28 条）与 4 个触发器不在 TS 调用图上；「某接口能否读某表」取决于 RLS，图谱不体现 | 迁移文件名清单 + 触发器 grep `[已确认]` |
| 7 | **外部服务运行时行为** | 高德的限流/QPS/数字签名、DeepSeek 的返回结构、企业微信的 `60020`（可信域名+固定 IP 前置）都只能在运行期暴露 | `lib/amap.ts`、`lib/deepseek.ts`、`lib/order-notify.ts` `[已确认]` |
| 8 | **进程内缓存与单例状态** | `cachedDistanceMatrix` 的 `matrixCache`（10 分钟）、`guest-rate-limit` 的 `Map`、`amap-loader` 的 `pending` promise、`amap.ts:79` 的串行队列 `amapQueue`、`amap.ts:346 usageTimer` 都是模块级变量，多实例/重启行为图谱看不到 | `lib/amap.ts:648` / `:79`、`lib/guest-rate-limit.ts:109+`、`lib/amap-loader.ts:44` `[已确认]` `[风险]` |
| 9 | **浏览器端轮询定时器** | `setInterval` 在 5 处（心跳/角标/在线/核销/用量 flush），生命周期与卸载清理只能靠人工审查 | §1.6 表 `[已确认]` |
| 10 | **`sessionStorage` 草稿态** | 游客链路的关键状态（`TryDraft`、`importedPlaces`）只存在浏览器，服务端与图谱都看不到；「保存后是否正确落库」只能端到端验证 | `lib/draft.ts:87-106` `[已确认]` `[风险]` |
| 11 | **动态路径参数** | `[id]` / `[token]` 段的实际取值来源与校验强度取决于各 handler 内部，图谱只标「动态段」 | §1.3 / §1.5 `[已确认]` |
| 12 | **`service_role` 越权面** | 静态分析无法判断某处查询是否把用户可控输入带进了 `admin` 客户端；需人工逐接口审查 | 22 个文件（app 17 + lib 5）`[风险]` |
| 13 | **无自动化测试** | 0 个 test/spec 文件，任意一次改动的影响面**只能靠人工回归**，图谱的「no tests found」对每个符号都成立 | `find ... -name "*.test.*"` → 空 `[已确认]` `[风险]` |
| 14 | **`File-PRD/` 历史文档** | 只读参考，不参与代码分析；其中的旧原型/旧字段可能已与实现不一致 | AGENTS.md §0 `[已确认]` |

---

## 6. 后续维护提示（给阶段 3 及之后）

1. 改 `lib/member-quota.ts`（尤其 `limitsOf` / `consumeRouteQuota`）前先用 `codegraph callers limitsOf` 复核 14 个调用方，再按四类行为（游客/免费/会员/管理员）逐个回归。`[已确认]`
2. 改 `lib/guest-rate-limit.ts` 前确认是否误伤 `api/ai/extract`（登录用户接口）。`[已确认]`
3. 任何「游客页 / 普通页」改动都应优先改共用组件（`TripSettingsFields`、`MESSAGES`），而不是各改一份 —— 现有 `TryPickClient` 与 `RoutePlacesClient` 已是两份实现。`[已确认]`
4. 涉及 `createAdminClient` 的改动必须按「绕 RLS」处理，逐处确认入参来源可信。`[已确认]`
5. 本仓库**没有测试**，任何 `typecheck` 通过都不等于行为正确；验收必须人工走查并在汇报里写「未覆盖」。`[已确认]`
