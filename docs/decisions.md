> 状态：已核对（Harness 2026-10-21 00:10 复核：结构、鉴权口径、数据模型均与代码/库一致；偏差记入 known-issues B9）

# 决策记录（阶段 4 · 反向恢复：已经做出的取舍）

> 口径：只记录**已经做出**的决定（含代码中已固化的、与历史验证记录中用户已拍板的），每条按「背景 / 决定 / 理由 / 影响」四段，附证据。未拍板的疑问在 `docs/open-questions.md`，不在本文。

## D-01 免登录限流按接口成本分桶（T01b/T01c）

- **背景**：游客试用最初所有接口共用 3 次/日限流。游客来回切步骤时，零成本的只读接口（读库内地点）也被 3 次挡住，表现为「游客读不出数据库里的地点」，当天不可恢复（历史实测 bug）。
- **决定**：按接口成本分五桶——花钱桶 `import`/`order` 3 次/日（DeepSeek+高德消耗，`Project/config/business.ts:72`）；只读桶 `city-places` 100 次/日（T01b，`:79`）；同批数据手动重排桶 `reorder` 60 次/日（T01c，`:85`）；另有 `ai-extract` 桶。分流实现在 `Project/lib/guest-rate-limit.ts:99` `dailyLimitOf(bucket)`，消费点 `:113`；`POST /api/try/order` 按 `manual ? 'reorder' : 'order'` 选桶（`Project/app/api/try/order/route.ts:102-108`），manual=true 跳过距离矩阵只算分段（命中 30 天落库缓存，成本极低）。
- **理由**：限流目的是保护第三方额度，不是限制正常体验；零消耗接口与全量重算接口共用额度等于「能生成路线却动不了顺序」。
- **影响**：新增免登录接口前必须先定桶，不得默认套 3 次/日（AGENTS.md §2.1 铁律 2）；`checkGuestRateLimit` 有 8 个调用方（CLI 实测），改限流需区分调用方是否登录（`Project/app/api/ai/extract/route.ts` 同时含 getUser 与游客桶调用，known-issues A2）。

## D-02 游客页复用普通用户组件，不复制实现

- **背景**：游客第 1 步「设置路线」曾出现「选出发城市会改掉终点城市与路线标题」的真人报障——单个 `city` state 同时驱动「城市网格」与「标题前缀」两个语义字段；且历史上游客页/普通页两套独立实现已分叉出多个 bug（L44–L49 教训）。
- **决定**：① 拆字段：终点城市只读锁定（来自 `/city` 的 `?city=` 或草稿），出发城市为独立必填字段，`TryDraft` 含 `originCity`；② 复用组件：游客页直接引用普通用户同一组件 `Project/components/route/TripSettingsFields.tsx`，为其增加 `sections?: TripSettingsSection[]` 裁剪参数（定义 `:129/:144`，消费 `:206/:312/:354`），游客只渲染 `['origin']`（`Project/components/try/TryNewClient.tsx:247`）。
- **理由**：两套独立实现必然分叉（AGENTS.md §2.1 铁律 4）；「一个 state 驱动两个语义字段」的修法是拆字段而非加判断屏蔽联动（铁律 6）。
- **影响**：`TripSettingsFields.tsx`（513 行）改动会双端生效，需游客/普通两侧回归；已知残留债务：第 2/3 步 `TryPickClient` vs `RoutePlacesClient`、`SortablePlaceRow` 仍是两份实现（known-issues A4，见 D-03 未竟部分）。

## D-03 AmapMap 可操作必须显式传 interactive

- **背景**：游客结果页地图「无法放大缩小」的真人报障。
- **决定**：`Project/components/map/AmapMap.tsx:178` 默认 `interactive=false`（纯展示安全），凡需要用户操作地图的页面必须显式传 `interactive`——`Project/components/try/TryResultClient.tsx:635`、`Project/components/route/RouteResultClient.tsx:1863`；组件内 `:308-311` 据此开关 dragEnable/zoomEnable/scrollWheel/doubleClickZoom。
- **理由**：默认关闭把「漏传」的后果变成「地图不能动」这种一眼可见的失败，好于默认开启导致展示地图意外可交互。
- **影响**：新增地图使用点时先判定「展示 or 操作」；该口径已写入 AGENTS.md §2.1 铁律 3。

## D-04 排序同步用 draftRef 写 sessionStorage，不走 setDraft

- **背景**：游客结果页用户刚拖完顺序又「跳回原顺序」——调序后若 `setDraft`，会触发依赖 `draft` 的重新生成 effect，把用户刚调好的顺序冲掉。
- **决定**：`Project/components/try/TryResultClient.tsx:261/:269` 用 `useRef` 保存最新草稿供「保存路线」读取（`draftRef`，消费 `:436/:474`），排序变化只写 sessionStorage、不改 state。
- **理由**：派生状态与 effect 依赖回路的标准解法是绕开 state 通道（AGENTS.md §2.1 铁律 5）；sessionStorage 是游客草稿的单一事实源（`Project/lib/draft.ts:87/:97`）。
- **影响**：改该页任何状态流之前必须先看 effect 依赖数组；「保存路线」读取的是 ref 而非 state，重构时易漏。

## D-05 游客能力口径：全流程可走、仅保存需登录、工具栏全置灰

- **背景**：游客模式边界曾有多版口径，需固定为唯一事实。
- **决定**（用户 2026-10-20 明确，project_memory 固化 + AGENTS.md §2.1 铁律 1）：游客**能用**「新建路线」完整功能（选城市→设置→导入/勾选→调顺序→看地图与分段里程），**唯一差别**是最后「保存路线」需登录（点保存 → 提示登录 → 跳 `/login?redirect=/try/result`，草稿留在 sessionStorage，登录后转正）；游客**不能用**顶部工具栏任何功能（含 logo 全部置灰去链接，移动端底部导航同）。代码落点：`Project/middleware.ts:29-32` 免登录放行 `/try/*`；`Project/config/routes.ts:62` `GUEST_TRY_ROUTES`。
- **理由**：试用链路的转化目标是「先体验完整价值，再换账号」；保存涉及写库与配额，必须绑定身份。
- **影响**：改动此口径前必须先问用户；游客导入地点不落库（无账号+RLS 限制），只进 sessionStorage 草稿 `importedPlaces` 字段，与库内地点合并参与勾选排序。

## D-06 会员路线配额改为「按月」计数（迁移 025）

- **背景**：会员权益口径为「每月 10 条路线」，原 `user_daily_usage` 按日计数无法表达月桶。
- **决定**：`Project/supabase/migrations/025_route_monthly_quota.sql:19-27`——复用 `user_daily_usage` 表，新增 `kind='generate_route_month'` 桶，`day` 字段存**当月 1 号**作为月键；读写经 `Project/lib/member-quota.ts` 的 `routeBucket:215`/`getRouteQuota:234`/`consumeRouteQuota:257`。
- **理由**：加桶不改表结构，迁移面最小（符合「不得擅自更换数据结构」的修改原则）；月键用 1 号日期而非新列，PostgREST 查询形状不变。
- **影响**：所有「路线条数」判定统一经 `limitsOf`（`Project/lib/member-quota.ts:90`，全站 14 callers 单点，known-issues A1）；管理员不限（`member_until` null=永久，`Project/app/api/admin/member/route.ts:63`）。

## D-07 收藏不建独立表，用 places.is_collected 软标记

- **背景**：收藏功能有多种建模方式（独立 favorites 表 / 布尔字段）。
- **决定**：基于现有 `places` 表的 `is_collected` 字段实现（迁移 003 字段、012:8-10 注释明确软删设计）；接口 `Project/app/api/collected/route.ts:14`(POST)/`:43`(DELETE)，DELETE 只回滚布尔值不删行（软标记 `:30-34`）。
- **理由**：收藏点同时要参与路线勾选、示例数据池（游客经 service_role 跨用户读 `is_collected=true` 汇总池，`Project/app/api/admin/seed-demo/route.ts:16-18` 注释），独立表会让两条读取链路都要 join；工程约定亦明确「收藏模块无需新建独立数据表」。
- **影响**：`places` 表同时承载「用户私有地点」与「公共示例池」两种语义，判定口径必须与 `/api/try/city-places` 一致（游客态徽章逻辑，`Project/app/(user)/city/page.tsx:3/:14`）。

## D-08 管理员默认享最高级会员（触发器固化）

- **背景**：产品规则「管理员账号默认享有最高级会员权限，不可通过任何接口或数据库操作取消」。
- **决定**：`Project/supabase/migrations/015:1-12` 注释 + `sync_admin_member` 触发器（`015:24-48`）在 role 变为 admin 时自动补齐会员字段；配合 `prevent_member_self_grant`（014→021:95-113）与 `prevent_role_change`（010:27-46）形成双向锁定：普通人无法自授，admin 会员态不会被误改。后台直授接口拒绝以 admin 为目标（`Project/app/api/admin/member/route.ts:50-52`，避免重复/冲突写入）。
- **理由**：规则写入数据库触发器层，比应用层判断更不可绕过（RLS 第二道防线口径）。
- **影响**：任何绕过应用直改库的操作都会触发 42501；测试脚本需预期此拒绝。

## D-09 注册用 admin.createUser + email_confirm 绕开邮件确认

- **背景**：自建 Supabase 默认未配置 SMTP，GoTrue 标准注册会因确认邮件发送失败而阻塞（历史实测教训）。
- **决定**：`Project/app/api/auth/register/route.ts:44-49` 用 `createAdminClient().auth.admin.createUser({ email_confirm: true })` 直接建号并确认，注释 `:14-18` 说明原因；登录态由接口内 `signInWithPassword` 建立。
- **理由**：在补齐 SMTP/国内邮件服务前保持注册可用；改动 Supabase 实例配置（自动确认开关）属于外部系统变更，应用侧方案更可控。
- **影响**：注册路径使用 service_role，邮箱唯一性/密码强度校验完全依赖本接口代码（`:20-43`），新增注册字段时不能假设 GoTrue 钩子生效。

## D-10 A5 处置：删除死接口 /api/amap/search，landmarks 加 getUser（已拍板、未执行）

- **背景**：阶段 2/4 审计发现 `POST /api/amap/search`（`Project/app/api/amap/search/route.ts:9`）全仓零调用方；`POST /api/amap/landmarks`（`Project/app/api/amap/landmarks/route.ts:27`）无 `getUser`、无游客限流，且 middleware 不覆盖 `/api/*`（known-issues A5）——两接口匿名可刷，消耗高德额度。
- **决定**（用户 2026-10-21 拍板，`docs/open-questions.md` Q-001 已解决）：删除 `/api/amap/search`；`/api/amap/landmarks` 增加 `getUser` 校验；**排入阶段 7 执行**，本阶段（文档恢复）不改任何源码。
- **理由**：死接口无保留价值；landmarks 是前端懒加载真实依赖，不能删只能收口。
- **影响**：执行前两者现状仍为「无鉴权可用」（`docs/feature-status.md` F-50 按现状记录）；执行后需回归周边知名地点懒加载功能与匿名 401。

## D-11 会员付费采用收款码 + 人工核销半自动模式

- **背景**：个人经营收款码无官方到账回调 API；微信小微商户需服务商代进件、支付宝当面付需营业执照，个人均不可自行开通（历史调研结论）。
- **决定**：收银台仅保留月卡（`Project/config/business.ts:145` `MEMBER_PLANS`；年卡/永久仅存 `Project/config/enums.ts` E25 供历史订单展示）；用户扫码付款后提交订单（`Project/app/api/member/orders/route.ts:28`，`amount_cents` 由服务端按档位写入、不信任前端金额），管理员企微提醒+后台核销（D-08 触发器链），用户端轮询感知（`Project/app/api/member/orders/status/route.ts:24`）；收款码隐藏头像/昵称/经营名称等隐私信息。`POST /api/member` 直开通口在 `ENABLE_REAL_PAYMENT=true` 时恒 400（`Project/app/api/member/route.ts:28-33`），防止绕过订单留痕。
- **理由**：在半自动约束下最大化闭环体验；订单记录付款方式（微信/支付宝双通道）便于对账。
- **影响**：全自动回调需待营业执照+商户号后升级，属已知边界（`docs/feature-status.md` F-44）；手动开通会员不计入付费订单（`member_logs` 区分来源 `member_source`）。

## D-12 服务端 Supabase 客户端统一注入 noStoreFetch（no-store + 5s 超时）

- **背景**：两个已证实的事故——① Next.js fetch Data Cache 按 URL 缓存 supabase-js GET 查询，第二次起永远读旧数据，导致用量看板/熔断降级/缓存读取端静默失效；② Supabase 服务端假死时 supabase-js 无默认超时，请求无限挂起（登录一直转圈）。
- **决定**：`Project/lib/supabase/fetch.ts:22` `noStoreFetch` 同时强制 `cache:'no-store'` 与 5s 超时（AbortController 实现以兼容 Edge runtime，沿用 `TimeoutError` 名称复用现有超时分支）；所有服务端客户端挂载：`server.ts:28`、`middleware.ts`、`admin.ts`（工程约定：新增服务端客户端必须挂）。
- **理由**：Data Cache 对「读实时配额/用量」是错误语义；假死时无超时的挂起会耗尽连接。
- **影响**：超时阈值 `BUSINESS.SUPABASE_TIMEOUT_MS=5000`；Supabase 冷启动首请求 18s 超时的历史现象会被该超时捕获并表现为一次失败重试（已知行为）。

## D-13 高德省额度体系：Key 池轮询 + 30 天落库缓存 + key_slot 用量熔断

- **背景**：高德个人认证 Key QPS 与月配额有限，单账号易触发限流；重复算路/搜索是主要浪费源。
- **决定**：多账号 Key 池（`AMAP_WEB_SERVICE_KEY/_2/_3` 三槽，`Project/config/env.ts:24-37` 逐个静态书写收集，注释 `:21-22` 说明动态键名打包不内联）轮询 `Project/lib/amap-key-pool.ts:34`；串行队列 ≥350ms + 退避重试（`Project/lib/amap.ts:79`）；leg/geocode/搜索结果落库缓存 30 天 TTL 跨用户共享（迁移 019/023）；用量按 `key_slot` 落 `amap_usage`（迁移 024），80% 预警、单 Key 达 95% 熔断跳过该槽、**仅全部 Key 达 95% 才整体降级直线估算**（`Project/lib/amap-usage.ts:182`）；周边知名地点改懒加载。
- **理由**：单个 Key 用满不应影响整体服务；缓存命中不消耗额度是 seed-demo 幂等重跑的前提（`Project/app/api/admin/seed-demo/route.ts:20-22` 注释）。
- **影响**：缓存读写失败静默按未命中处理（known-issues：`Project/lib/amap.ts:235-238`），额度会被无声多消耗——已记录为技术债 T-7（`docs/architecture.md` §6）。

## D-14 示例数据归属管理员账号、游客读跨用户 is_collected 汇总池

- **背景**：游客无账号但需要「有地点可选」；示例数据若绑定单一用户，RLS 下游客读不到。
- **决定**：`/api/admin/seed-demo` 把示例地点落成 `is_collected=true` 归管理员（`Project/app/api/admin/seed-demo/route.ts:16-18` 注释：与迁移 016 演示数据同口径）；游客经 `service_role` 跨用户读汇总池（`Project/app/api/try/city-places/route.ts:33`）；幂等键=「属主+城市+名称」，默认只补无数据城市（高德同城搜索结果跨调用会小幅轮换，重复扫已覆盖城市会追加近义重复，`:103-123` 注释）；PostgREST 1000 行静默截断经 `fetchAll` 显式分页解决（`:42-61`）。
- **理由**：places 表 RLS 仅授 authenticated 属设计如此，游客经 service_role 读是正确实现（Harness 复核口径）。
- **影响**：`places` 1326 行中示例数据占比未拆分统计（`docs/data-model.md` 待确认项）；重扫需显式 `?force=1` 或 `?cities=`。

## 15. 证据来源

- 代码内注释与实现（行号已逐条内联）：`Project/lib/guest-rate-limit.ts`、`Project/config/business.ts:72/79/85/145`、`Project/components/route/TripSettingsFields.tsx`、`Project/components/try/TryNewClient.tsx:247`、`Project/components/map/AmapMap.tsx:178/308-311`、`Project/components/try/TryResultClient.tsx:261/269/436/474/635`、`Project/app/api/try/order/route.ts:102-108`、`Project/supabase/migrations/025:19-27`、`015:1-12/24-48`、`012:8-10`、`010:27-46`、`021:95-113`、`Project/app/api/auth/register/route.ts:14-18/44-49`、`Project/app/api/member/route.ts:28-33`、`Project/app/api/admin/member/route.ts:50-52/63`、`Project/lib/supabase/fetch.ts:22`、`Project/config/env.ts:21-37`、`Project/lib/amap.ts:79/235-238`、`Project/lib/amap-key-pool.ts:34`、`Project/lib/amap-usage.ts:182`、`Project/app/api/admin/seed-demo/route.ts:16-22/42-61/103-123`、`Project/middleware.ts:29-32`、`Project/config/routes.ts:62`。
- 用户拍板记录：`docs/open-questions.md` Q-001（A5，2026-10-21）；`docs/progress.md` 变更摘要；project_memory「硬性约束」清单（游客口径、月卡唯一、收款码隐私、惰性回落、Key 池叠加等）。
- 历史教训：`File-PRD/项目进展与问题汇总-*.md` 迁来的 L 系列（AGENTS.md §2.1 铁律 1–6 即其固化）；`docs/known-issues.md` A1–A5。
- 取证命令：`codegraph callers limitsOf/checkGuestRateLimit/orderByMatrix`（CLI）；`mcp_codegraph_codegraph_explore`（MCP）；本轮迁移与 route 文件全文 Read。

## 16. 待确认事项

1. D-05 中「登录后一键转正」的 redirect 链路细节（`/login?redirect=/try/result` 的 redirect 白名单校验）未逐行核 [未知]。
2. D-01 的 `ai-extract` 桶具体额度数字本轮未取到行号（`Project/config/business.ts:72-85` 区间内，逐常量核对留待 Harness）[未知]。
3. D-11「手动开通不计入付费订单」在 `member_logs.member_source` 的取值枚举与统计口径需结合 `Project/config/enums.ts` 再确认 [高度可能]。
4. D-13「单 Key 95% 熔断跳过槽位」的槽位跳过分支（`pickWebKeySlot` 内部与 `getExhaustedWebKeySlots` 的接线）未逐行核（`docs/architecture.md` §8-2 同项）[高度可能]。
5. 各决策的**原始拍板时间**多数来自 project_memory/历史文档转述，本仓库 git log 未逐条对应到决策提交 [未知]。

## D-12 一键复位在普通/会员结果页要落库（方案 B）

- 背景：游客结果页拖拽不落库，复位天然「零请求」；但 `RouteResultClient` 是**拖拽即防抖 PUT 自动落库**的页面（`saveOrder :730-761`，调用点 movePlace/optimizeDay/boot）。因此「复位后不保存离开库内不变」在该页不可达。
- 决定（用户 2026-10-21 01:25 裁决）：复位 = **界面还原 + 立即经既有 `saveOrder()` 落库一次**。
- 理由：「不调接口、不耗额度」的真实意图是**不消耗高德 order 桶（3 次/日）**；一次本地 PUT 不碰高德、不占额度。
- 影响：复位后 Network 会出现 1 次 `PUT /api/routes/[id]/places`；离开重进显示复位后顺序。

## D-13 会员到期用 pg_cron 定时失效（T-004）

- 背景：PRD Q7 要求「到期自动解除身份，不依赖用户访问」；原实现只有读取侧惰性判定，存储值永不翻转。
- 选型：自建 Supabase 的 **pg_cron**（`shared_preload_libraries` 已含 pg_cron，扩展 1.6.4 可用），每日 **03:05** 执行一条 UPDATE。
- 边界：仅 `member = true and member_until is not null and member_until < now()`；永久会员（member_until 为 NULL）与管理员不受影响。
- 验证：临时改为每分钟调度，实测 `cron.job_run_details` 出现 `status=succeeded, return_message=UPDATE 0`（当前无过期会员），随后恢复 03:05。
- 回滚：`select cron.unschedule('expire-members'); drop extension if exists pg_cron;`
- 迁移固化：`Project/supabase/migrations/026_member_expire_cron.sql`（幂等）
- 未做（记录为后续）：任务里不写 `member_logs` 审计；如需留痕，在 UPDATE 后追加一条 insert。

## D-14 内测阶段不开放收费（个人主体备案）

- 背景：用户 2026-10-22 决定以**个人主体**提交 ICP 备案。个人备案属"非经营性"，**不得开展在线收费**；而本项目商业模式是会员付费，严格讲属经营性，需企业主体 + ICP 许可证。
- 决定：**内测阶段关闭对外付费入口**（会员购买/下单），保留会员权益展示与后台核销（内部验证用）。
- 实现：新增配置开关 `BILLING_ENABLED`（默认 `false`）。
  - `false`：隐藏「升级会员 / 立即开通」及收银台，展示"内测阶段暂未开放购买"；`MemberUpsellCard` 不渲染。
  - `true`：恢复现状（等企业主体与经营性备案就绪后开启）。
- 影响：用户侧无法下单；后台仍可手工核销历史订单；`/api/member/orders` 建议同时拒绝新下单（服务端兜底，不能只靠前端隐藏）。
- 何时开启：企业/个体户主体 + 经营性备案（或 ICP 许可证）就绪后，改一个开关即可。
