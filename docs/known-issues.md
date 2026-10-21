> 状态：已核对（Harness 2026-10-20 23:58 复核：版本/命令/风险均已抽样验证，数据库事实见 `known-issues.md` §0）

# 已知问题 · 风险 · 技术债（阶段 3 · P3）

> 来源：`docs/module-map.md`（448 行）的 26 条 `[风险]` 与 12 条 `[未知]`、本轮新发现、项目记忆 L 系列教训。
> 分级：A=最高优先（module-map 四条 + 本轮新增无鉴权）；B=需排期；C=观察项。

## 0. Harness 复核结论（2026-10-20 23:55，独立实跑，不采信自述）

**数据库侧（Trae 被禁止做，由 Harness 直连只读完成）**

| 核实项 | 结果 | 方式 |
|---|---|---|
| 表清单 | **14 张**（与 25 份迁移对照，见 `open-questions.md` Q-002 待核迁移应用状态） | `GET /rest/v1/` OpenAPI |
| 行数 | users 3 / places 1326 / cities 92 / routes 5 / route_places 41 / imports 6 / events 42 / member_orders **0** / member_logs 3 / user_daily_usage 2 / route_shares 1 / amap_leg_cache 503 / amap_geocode_cache 228 / amap_usage 15 | service_role 只读计数（仅取 `Content-Range`） |
| **RLS 实测** | **生效**。匿名 key 请求 users / member_orders / places / routes / user_daily_usage / imports / events / amap_usage **全部 0 行**；`places` 实际 1326 行 → 排除「表本身为空」 | anon key 实测 8 张表 |

**代码侧抽样**

| 核实项 | 结果 |
|---|---|
| A1 `limitsOf` 14 调用方 | ✅ 实跑 `codegraph callers limitsOf` = **14** |
| A5 两个高德代理接口无鉴权 | ✅ 确认 → **已修复并关闭（T-001，2026-10-21）**：`search/route.ts` 整目录删除（匿名 POST 实测 404）；`landmarks/route.ts` 读 body 前加 `auth.getUser()`，未登录 401（实测）。原确认：`app/api/amap/search/route.ts:9` 的 POST 全文无 `getUser`、无 `checkGuestRateLimit`；`app/api/amap/landmarks/route.ts:27` 仅 `isAmapQuotaCritical` 熔断判断；`Project/middleware.ts` 对 `/api/*` 一律放行（只在页面路由上做重定向） |
| 技术栈版本 | ✅ 抽查 next 14.2.15 / typescript 5.9.3 / tailwind 3.4.19 / @supabase/supabase-js 2.117.3 与 `package-lock.json` 一致 |
| typecheck | ✅ 独立复跑 `tsc --noEmit` exit 0 |
| 文档是否泄密 | ✅ 全文扫描无真实密钥形态串；18 个变量名齐全、无值 |

> `[风险]` A5 已升级为**需要产品决策**（Q-001）：无论「有意」与否，当前状态下匿名可无限调用高德搜索，直接消耗额度。→ **后续：决策完成且 T-001 已修复（2026-10-21），A5 关闭。**

## 1. A 级：最高优先风险

### A1. 配额单点：`limitsOf` 有 14 个调用方 `[已确认]`
- 位置：定义 `Project/lib/member-quota.ts:90`；调用方经 **CLI** `codegraph callers limitsOf` 实测 14 处，含 `Project/app/api/try/promote/route.ts:54`、`Project/app/api/ai/extract/route.ts:29`、`Project/app/api/routes/[id]/places/route.ts:26`、`Project/app/api/routes/route.ts:24`、`Project/app/api/collected/route.ts:43` 等。
- 影响：改一个配额数字同时改变游客试用 / 路线保存 / 收藏加路线 / 文案提取四类行为，且无测试兜底。
- 证据：`docs/module-map.md` §4.5 样例 C。

### A2. 游客限流函数被登录接口共用 `[已确认]`
- 位置：`Project/lib/guest-rate-limit.ts:109`（`checkGuestRateLimit`，**CLI** `codegraph callers` 实测 8 callers）；其中 `Project/app/api/ai/extract/route.ts:29` 是**登录用户**接口（该文件同时含 `auth.getUser` 与 `checkGuestRateLimit` 调用，本轮鉴权矩阵实测 getUser=1 guestRL=2）。
- 影响：改动限流逻辑可能误伤登录用户路径；且计数是进程内 `Map`（`Project/lib/guest-rate-limit.ts:109-134`），重启/多实例即清零，**不是持久化限流**。
- 证据：`docs/module-map.md` §4.5 样例 A（MCP + CLI 双证）。

### A3. 3 个 Server Component 页面用 `service_role` 直查库、绕过 API 层与 RLS `[已确认]`
- 位置（全路径+行号）：`Project/app/admin/orders/page.tsx:14`、`Project/app/(user)/city/page.tsx:14`、`Project/app/share/[token]/page.tsx:20`、`:54`。
- 影响：`createAdminClient` 绕 RLS；页面对查询失败只能整页兜底，没有 API 层的入参校验与错误码约定；改表结构需同步改页面。全库 `createAdminClient` 出现于 22 个文件（app 17 + lib 5）。
- 证据：`grep -rln 'createAdminClient' Project/app Project/lib` 实测；`docs/module-map.md` §4.1。
- `[风险]` 静态分析无法证明这 3 处查询不含用户可控注入面，需 Harness 逐处人工审查。

### A4. 游客页与普通用户页双实现（违反 AGENTS.md L48 铁律）`[已确认]`
- 位置：`Project/components/try/TryPickClient.tsx`（572 行，内部 `filterTabCls`:60 / `pickCls`:62 / `typeIconCls`:66）vs `Project/components/route/RoutePlacesClient.tsx`（526 行，同名三函数 `:46/:48/:52`）；结果页 `Project/components/try/TryResultClient.tsx:88`（`SortablePlaceRow`）vs `Project/components/route/RouteResultClient.tsx:444`（同名）。
- 影响：两套独立实现必然分叉（历史上已因此出过 4 个真人实测 bug）。
- 证据：`docs/module-map.md` §4.3。

### A5.【本轮新发现】两个高德代理 API 无登录校验，匿名可刷 `[已确认]` `[风险]`
- 位置：`Project/app/api/amap/search/route.ts:10`（POST 全文无 `auth.getUser`、无 `checkGuestRateLimit`）；`Project/app/api/amap/landmarks/route.ts:27`（同样无登录校验，仅有额度熔断判断 `isAmapQuotaCritical`）。
- 依据：本轮对 30 个 route 的鉴权矩阵实测——这两个文件 `getUser=0 admin=0 guestRL=0`；且 `Project/middleware.ts:25-50` 的 `PROTECTED_ROUTES`（`Project/config/routes.ts:56` = `/routes`、`/route`、`/profile`、`/collected`）**不覆盖 `/api/*`**，middleware 对未匹配路径直接放行（`:53`）。
- 影响：任何未登录访客可无限调用地点搜索与周边地标，直接消耗高德 Web 服务额度（地标虽有 12 小时进程内缓存 `Project/app/api/amap/landmarks/route.ts:17-18`，但搜索无此保护）。
- 精确化（Harness 复核）：`/api/amap/search` **无任何调用方**（前端/服务端/脚本 grep 均为 0），属**死接口**；真正的搜索走 `Project/app/api/places/route.ts:92`（有 `getUser`）。`/api/amap/landmarks` 仅被 `Project/components/route/RouteResultClient.tsx:1119` 调用，所在页面受保护但接口本身不验身份。
- **已决策（用户 2026-10-21）**：删除 `/api/amap/search`；`/api/amap/landmarks` 加 `getUser`。
- **已修复（T-001，2026-10-21）**：`Project/app/api/amap/search/` 整目录已删除（匿名 POST 实测 404）；`Project/app/api/amap/landmarks/route.ts` 在读取 body 前加 `auth.getUser()`，未登录 401 + `MESSAGES.LOGIN_FIRST`（匿名实测 401）。熔断、缓存、返回结构均未动。登录态 200 由用户人工验收。**A5 关闭**。

## 2. B 级：需排期处理

| # | 问题 | 位置（全路径:行） | 证据 | 标记 |
|---|---|---|---|---|
| B1 | 高德缓存读写失败**静默**（catch 后按未命中处理），额度会被无声多耗 | `Project/lib/amap.ts:235-238`（readLegCache）、`:246` 注释「失败静默（只 warn）」 | 读原文 `[已确认]` | `[风险]` |
| B2 | 进程内状态不持久：矩阵缓存 10 分钟（`Project/lib/amap.ts:647-648`）、地标缓存 12 小时、游客限流 Map、JS 脚本 `pending`（`Project/lib/amap-loader.ts:44`）——重启即清零，多实例互不可见 | 上列各文件 | 读原文 `[已确认]` | `[风险]` |
| B3 | 重复实现 7 组：`straightMeters`×2（`Project/app/api/amap/route/route.ts:29`、`Project/app/api/try/order/route.ts:50`）、`estimateLeg`×2（同两文件 `:43`/`:64`）、`localDayString`×3（`Project/lib/member-quota.ts:148`、`Project/lib/guest-rate-limit.ts:37`、`Project/lib/amap-usage.ts:81`）、`fmtTime`×5、`isActive`×2、`nullableText`×2、`SortablePlaceRow`×2 | 全部行号见 `docs/module-map.md` §4.3 | grep 实测 `[已确认]` | `[风险]` 时区/距离口径改一漏二 |
| B4 | 超大文件：`Project/components/route/RouteResultClient.tsx` 1,930 行、`Project/config/messages.ts` 1,685 行（91 文件引用）、`Project/components/route/RouteAddClient.tsx` 859 行、`Project/lib/amap.ts` 814 行 | `wc -l` 实测 | `[已确认]` | `[风险]` |
| B5 | `ai/extract` 与 `try/extract` 两套提取接口高度相似（131 / 157 行，共用 `extractPlacesAndCity` + `link-fetch` 三函数），改提取规则要同步两处 | `Project/app/api/ai/extract/route.ts:1-20`、`Project/app/api/try/extract/route.ts:1-13` | import 清单实测 `[已确认]` | `[风险]` |
| B6 | 无自动化测试 + 无 CI：任何改动只能 typecheck + 人工走查 | `Project/package.json:6-10` 无 test；`.github/` 不存在 | `[已确认]` | `[风险]` |
| B7 | 会员到期、用量熔断、在线状态全靠「请求时惰性判定 / 浏览器轮询」，无服务端定时任务；用户不开页面则 `users.member` 存储值不翻转（读取侧判定正确） | `Project/app/api/member/orders/status/route.ts:18/:52`（`isMemberActive`）；5 处 `setInterval` 见 `docs/module-map.md` §1.6 | `[已确认]` | `[风险]` |
| B8 | 收款码半自动核销：个人经营收款码无官方到账回调，全自动开通需营业执照 + 商户号 | 项目记忆 + `Project/app/api/member/orders/route.ts:28`（下单）→ 管理员人工核销 `Project/app/api/admin/member/orders/[id]/route.ts:21` | `[已确认]` | `[风险]` 业务约束非代码缺陷 |

| ~~B9~~ | ~~城市清单 104 vs 92 不一致~~ → **误报，已关闭（2026-10-21 00:50）**：用 TypeScript 编译器求值 `config/cities.ts`，`CITIES` = **92**、`CITY_PINYIN` = 92、`CITY_CARDS` = 12、`HOT_CITIES` = 10；与库内 `cities` **92** 行、迁移 `011_seed_cities.sql` **92** 条完全一致，**不存在错位**。原「104」来自 `grep -c "name: "` 把 CityCard 的非城市名字段一并计入的错误口径 | 复核方式：`node -e` + typescript transpile 求值（Harness 2026-10-21）| 已关闭 |

## 3. C 级：观察项 / 环境债

| # | 问题 | 证据 | 标记 |
|---|---|---|---|
| C1 | 自建 Supabase 跑在 Windows 家庭版 Docker Desktop，有**服务端假死史**（TCP 通但 HTTP 不回字节），是「取数慢/卡死」根因；迁移腾讯云方案已定未实施 | 项目记忆教训；`docs/progress.md` §5 | `[风险]` |
| C2 | `.env.local` 缺 9 个变量（高德私钥 3、Key 池第 3 槽、JS Key 第 2 槽、企微自建应用 4）——当前功能可用但额度叠加/签名/个人微信通知未启用 | `grep -oE '^[A-Z_0-9]+=' Project/.env.local` 实测 9 个 vs `.env.example` 18 个 `[已确认]` | `[已确认]` |
| C3 | `Project/public/` 有残留：`750x750png`（无扩展名、未跟踪）、`logo.svg.zip`、`.DS_Store`、`pay-qr.*` 4 份（含经营信息，禁止触碰） | `ls -la Project/public/` `[已确认]` | `[风险]` 处置需用户决定 |
| C4 | 本地 main 领先 origin 多个提交未 push（截至 23:58 为 11 笔） | `git status -sb` `[已确认]` | `[已确认]` |
| C5 | ~~`docs/progress.md` 阻塞表留「MCP 未注册」过时行~~ → **已修复**（Harness 23:58 删除该行，改为 A5 无鉴权） | `grep MCP docs/progress.md` 已无过时行 | 已关闭 |
| C9 | **分享页超时被误报为「链接已失效」**：自建 Supabase 冷启动时 `/share/[token]` 查询超时（实测 7.03s），`try/catch` 把异常吞掉后落到失效页，用户看到「该分享链接不存在」而非「稍后重试」。实测同一 token 预热后 0.04s 正常 | Harness 2026-10-22 实测（3 次 7.03s 失败 → 预热后 0.04s 成功） | `[风险]` 误伤真实分享链接的可信度；建议区分「查询失败」与「确实不存在」两种状态 |
| C7 | `Project/` 下 4 项未被现有文档覆盖：`Project/docs/`（4 份历史文档）、`Project/travel-food-route.zip`（161,861 字节）、`Project/components.json`（shadcn 配置）、`Project/tsconfig.tsbuildinfo` | P6B 只读理解实测（`ls`）；处理意见：zip 与 Project/docs 需用户决定去留 | `[未知]` |
| C8 | 文档精度债：`buildRouteSnapshot` 实为 `export async function`（`Project/lib/route-share.ts:69`），引用处未标 async，实现时须 await | P6B 实测 + Harness 复核 `sed -n '69p'` | `[风险]` 低，实现阶段注意 |
| C6 | `routes.is_public` 公开路线第一版关闭、`routes.transport` check 仅 `walk/bike`（018 迁移扩了 4 种，需 Harness 核对最终列定义） | `Project/supabase/migrations/004_create_routes.sql`（check 约束）vs 018 迁移 `[已确认]`（004 原文） | `[未知]` 以 018 之后为准 |

## 4. 需要用户/原开发者补充确认（无法从代码判定）

1. A5 两个无鉴权 API 是否有意为之（当作公开搜索代理）？还是遗漏？→ 需产品决策。
2. 92 城示例数据当前库内真实行数（1,307 为 10-20 操作后数字）→ Harness 只读 SELECT 复核。
3. 迁移是否全部在目标 Supabase 实例应用（025 经 `/pg/query` 执行过，其余 24 份状态未核对）→ Harness 查 `schema_migrations` 或逐表验证。
4. 企业微信自建应用通道何时启用（依赖备案域名 + 固定 IP）→ 用户上线计划。
5. 是否引入测试框架（playwright 候选）→ 用户决策（progress.md §5 已挂起）。
