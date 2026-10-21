> 状态：已核对（Harness 2026-10-21 00:10 复核：结构、鉴权口径、数据模型均与代码/库一致；偏差记入 known-issues B9）

# 功能状态清单（阶段 4 · 反向恢复）

> 口径：六分级——**已实现 / 部分实现 / 仅界面 / 仅接口 / 未实现 / 有缺陷**。每条带证据（全路径 `文件:行`）、验收标准、回归测试建议。项目无自动化测试（`find Project -name "*.test.*"` → 空），所有「回归测试建议」均为**人工走查步骤**。功能是否「正确」的最终判定权在用户（AGENTS.md §0 分工），本文只记录代码层现状。

## 1. 已实现（代码完整、链路闭环、有历史人工验证记录）

### F-01 游客三步试用（免登录生成路线）
- **证据**：`Project/middleware.ts:29-32` 放行 `/try/*`；`Project/app/api/try/city-places/route.ts:33`（只读桶）、`Project/app/api/try/order/route.ts:88`（order/reorder 双桶，`:102-108` manual 分支）、`Project/components/try/TryResultClient.tsx:635`（地图显式 `interactive`）；排序 `Project/lib/route-order.ts:173` + 矩阵 `Project/lib/amap.ts:650` + 兜底 `Project/app/api/try/order/route.ts:64`。
- **验收标准**：游客从 `/city` 进入可完整走完三步，看到地图、顺序、分段里程；全程不写库；第 3 步地图可拖动缩放、地点可拖拽/上下移/弹层跳转序号。
- **回归建议**：无痕窗口连走 3 次（order 桶 3 次/日）+ 结果页拖 2 下顺序（验证 reorder 桶不被 429 挡）；检查库内 `routes` 行数不变。

### F-02 游客草稿 sessionStorage 与登录转正
- **证据**：`Project/lib/draft.ts:87`(`readTryDraft`)/`:97`(`saveTryDraft`)/`:106`(`clearTryDraft`)；转正链路 `Project/app/api/try/promote/route.ts:54` → `places.insert :201`（失败回滚 `:176`）→ `routes.insert :229` → `route_places.insert :253` → `consumeRouteQuota`（`Project/lib/member-quota.ts:257`）；排序同步用 draftRef 不触发重排 effect（`Project/components/try/TryResultClient.tsx:261/:269/:436/:474`）。
- **验收标准**：游客第 3 步点保存 → 跳 `/login?redirect=/try/result`；登录后草稿仍在、一键转正落库并出现在「我的路线」；关闭页面草稿归零。
- **回归建议**：完整走「游客建草稿 → 登录 → 转正」，核对 `routes`/`route_places` 行数与页面顺序一致；再手动调序后保存，确认保存的是调序后的顺序。

### F-03 路线排序算法（贪心最近邻 + 2-opt + 距离矩阵）
- **证据**：`Project/lib/route-order.ts:173`(`orderByMatrix`，6 callers 经 CLI `codegraph callers` 实测)、`:83`(`orderByStraightLine`)、`:197`(`distributeByDays`)；cos 纬度校正与 2-opt 在该文件内实现。
- **验收标准**：多点（≥6）路线无明显交叉折返；单日/多日分配符合天数设置。
- **回归建议**：同一批地点分别用游客桶与登录用户 `/api/amap/order`（`Project/app/api/amap/order/route.ts:21`）重排，两条链路顺序结果应一致（同一 `orderByMatrix`）。

### F-04 地图展示与交互（结果页/详情页）
- **证据**：`Project/components/map/AmapMap.tsx:178`（默认 `interactive=false`）、`:308-311`（dragEnable/zoomEnable/scrollWheel/doubleClickZoom 按 interactive 开关）；显式传参处 `Project/components/try/TryResultClient.tsx:635`、`Project/components/route/RouteResultClient.tsx:1863`；JS API 1.4.15 动态注入 `Project/lib/amap-loader.ts:53/:69`；导航唤起 `Project/lib/amap-uri.ts:36/:52`。
- **验收标准**：凡需要用户操作地图的页面均可拖动、缩放；地图隐藏周边商家 POI；手机端「手机高德导航」按钮可唤起高德 App。
- **回归建议**：结果页、游客结果页、路线详情三处逐一拖动缩放；真机点导航按钮验证 scheme 跳转与 1.5s 兜底提示。

### F-05 收藏（基于 places.is_collected，无独立表）
- **证据**：`Project/app/api/collected/route.ts:14`(POST)/`:43`(DELETE)，软标记 `:30-34`，单日地点上限 `limitsOf` `:105-106`，非本人 403 `:116-125`；字段定义迁移 003/012（`Project/supabase/migrations/012:8-10` 注释说明软删设计）。
- **验收标准**：勾选/取消收藏即时生效；收藏夹按城市分组、组内计数正确；把收藏点加入路线受档位单日上限约束。
- **回归建议**：免费档用户尝试单日加到第 7 个地点应被拒（上限 6）；DELETE 后 `places.is_collected` 回 false 且行不删。

### F-06 会员订单半自动闭环（下单→提醒→核销→轮询生效）
- **证据**：链路 15 跳全带行号（`docs/module-map.md` §3.3）：`Project/components/profile/MemberCard.tsx:121` → `Project/app/api/member/orders/route.ts:28`（待核销上限 `:66-71`、insert `:75-76`）→ `notifyNewMemberOrder`（`Project/lib/order-notify.ts:174`，Webhook `:73/:166`）→ 角标轮询 `Project/components/layout/AdminShell.tsx:71` → 核销 `Project/app/api/admin/member/orders/[id]/route.ts:21`（PENDING 校验 `:54/:61`、`users.update :88-94`、`member_logs.insert :101`、APPROVED `:109-111`）→ 用户端感知 `Project/app/api/member/orders/status/route.ts:24`（`isMemberActive :18-22`）。
- **验收标准**：用户提交订单后管理员企微群收到提醒；后台红色角标数字=待核销数；核销后用户扫码页自动关闭显示开通成功，无需刷新；驳回订单不改变会员状态。
- **回归建议**：测试账号下单 → 管理员核销全程走一遍；核对 `member_orders`/`member_logs`/`users.member_until` 三处一致；重复核销同一订单应被状态校验拒绝。

### F-07 会员到期惰性回落
- **证据**：`Project/lib/member-quota.ts:78`(`isMemberActive`：member=true 且 `member_until` null=永久、未来=有效、过期=回落)；消费点 `tierOf :64`、`Project/app/api/member/orders/status/route.ts:18-22`；后台直授 `member_until` null 即永久（`Project/app/api/admin/member/route.ts:63`）。
- **验收标准**：把测试用户 `member_until` 改为过去时间后，档位立即回落免费（无需任何定时任务）。
- **回归建议**：改库（测试账号）→ 刷新个人中心权益卡应显示免费档规则（`Project/config/business.ts` 三档常量）。

### F-08 路线分享（令牌 + 长图 + 二维码 + 分享页）
- **证据**：`Project/app/api/routes/[id]/share/route.ts:40`(POST 生成)/`:104`(DELETE 撤销)；令牌生成 `Project/lib/route-share.ts:25`；快照 `buildRouteSnapshot :69`；长图纯客户端 Canvas `Project/lib/route-poster.ts:99`(`renderRoutePoster`) + qrcode 1.5.4；分享页 `Project/app/share/[token]/page.tsx:8/:20/:54`（service_role 读快照，零高德调用）。
- **F-52 分享分级（T-007 已实施）**：`page.tsx` 服务端按 `viewerTier` 分渲染——会员/管理员走原 `ShareViewClient`（完整快照+导入）；非会员/游客走 `buildPosterView` 最小契约（title/cityName/days/totalPlaces/dayPlans 名称与顺序/exportedAt，**不含 lat/lng/address/transport/lodging**）+ `Project/components/share/SharePosterCard.tsx`（客户端 canvas 海报 + 保存为图片 + 升级引导，二维码编码当前页 URL、token 不经 props）。匿名 curl 实测敏感数据键零下发；import 接口鉴权未动（匿名 401 复测）。海报图片渲染与会员视图回归需真人浏览器，待走查。
- **验收标准**：仅会员可导出；每次导出生成新令牌、旧令牌/旧二维码立即失效；分享页无地图无导航按钮。
- **回归建议**：导出两次后用第一个 token 访问应 404/失效；非会员账号点导出应被挡。

### F-09 登录/注册/退出/忘记密码
- **证据**：`Project/app/api/auth/login/route.ts:16`（`signInWithPassword :38`、读 `users :68`）；`Project/app/api/auth/register/route.ts:20`（`admin.createUser` + `email_confirm:true` 绕 SMTP `:44-49`）；`Project/app/api/auth/logout/route.ts:7`（`signOut :9`）；`Project/app/api/auth/reset-password/route.ts:60`（三道保护：admin 禁改/IP 每小时 5 次/企微提醒 `notifyPasswordReset` `Project/lib/order-notify.ts:186`）。
- **验收标准**：登录失败提示区分「连接失败/邮箱未确认/密码错误」；退出后跳对应登录页（普通 `/login`、管理员 `/admin/login`）；重置只改密码不动其他字段。
- **回归建议**：错误密码、未确认邮箱、admin 邮箱三类分别提交核对提示文案；重置成功后核对 `users` 其余字段未变。

### F-10 防提权（RLS + 4 触发器）
- **证据**：14 表全开 RLS（Harness Q-102 实测：匿名读 8 张敏感表 0 行）；触发器 `prevent_role_change`（`Project/supabase/migrations/010:27-46`）、`prevent_member_self_grant`（014→021:95-113 扩至 5 字段）、`handle_new_user`（010:5-22）、`sync_admin_member`（015:24-48）；历史实测普通用户改 member/role/member_until/trial_multi_day_used 均被 42501 拒绝。
- **验收标准**：任何前端可控路径无法把自身 role 改为 admin 或自授会员。
- **回归建议**：用普通用户 JWT 直接 PATCH `users` 表 5 个敏感字段，应全部 42501（历史验证方法见 project_memory 教训）。

### F-11 高德省额度三件套（Key 池 + 落库缓存 + 用量熔断）
- **证据**：Key 池 `Project/lib/amap-key-pool.ts:34` + 槽位收集 `Project/config/env.ts:24-37`；leg 缓存 `amap_leg_cache`（迁移 019，30 天 TTL）、geocode/搜索缓存 `amap_geocode_cache`（迁移 023）；用量按 `key_slot` 落 `amap_usage`（迁移 024 `bump_amap_usage` 5 参）；80% 预警/95% 降级判定 `Project/lib/amap-usage.ts:165/:182/:195`；串行 ≥350ms `Project/lib/amap.ts:79`。
- **验收标准**：重复查询同城同关键词不再消耗高德额度（命中缓存）；用量看板数字与 `amap_usage` 表一致。
- **回归建议**：同一城市两次执行 `/api/admin/seed-demo`，第二次 `amap_usage` 增量应≈0（缓存命中，`Project/app/api/admin/seed-demo/route.ts:20-22` 注释）。

### F-12 管理后台（7 页面 + 6 API + seed-demo）
- **证据**：`Project/app/admin/page.tsx:48`（看板）、`users/places/routes/imports/orders/online` 各 page；`DELETE /api/admin/users/[id]`（`route.ts:14`，不能删管理员/自己 `:33-35/:48-50`）；`POST /api/admin/member`（`:13`，目标为 admin 拒绝 `:50-52`）；`POST /api/admin/seed-demo`（`:77`，1000 行分页防截断 `:42-61`，`maxDuration 800` `:40`）。
- **验收标准**：admin 以外角色访问任一后台接口 403；seed-demo 幂等（同城同名不重复插入）。
- **回归建议**：普通用户 JWT 调 6 个 admin API 应全 403；seed-demo 连跑两次核对 `places` 行数第二次不增。

### F-13 游客五桶限流
- **证据**：`Project/lib/guest-rate-limit.ts:69`(`resolveGuestKey`)、`:99`(`dailyLimitOf`)、`:109`(`checkGuestRateLimit`，8 callers)；额度 `Project/config/business.ts:72`(3)/`:79`(100)/`:85`(60)；cookie 持久化访客 ID（`GUEST_COOKIE :20`）。
- **验收标准**：花钱桶（import/order）3 次/日、city-places 100/日、reorder 60/日；超限 429 带明确文案；同 IP 私有地址豁免逻辑存在（`isPrivateOrLoopbackIp :55`）。
- **回归建议**：用 `curl -b jar -c jar` 复用同一 cookie 连打 4 次 order 桶接口，第 4 次应 429（不带 cookie 的循环测试无效——历史教训）。

### F-14 一键复位 · 游客结果页（PRD F-50 / T-005，2026-10-21 实施，**待用户人工走查**）
- **证据**：`Project/components/try/TryResultClient.tsx:263`（`initialOrderRef` 快照 ref，仅重排 effect 成功分支 `:327` 写入——覆盖首进/切模式/重试三入口，手动调序不更新）、`:344-348`（渲染期派生 `orderDirty`，按 `sortIdOf` 比对）、`:463-485`（`resetOrder()`：`setResult` 浅拷贝快照成对还原 points+legs+总量 → `draftRef`/`saveTryDraft` 同步草稿，**零 fetch、不 setDraft**，D-04）、`:675-688`（列表头行常驻按钮，`disabled={!orderDirty || reordering || !initialOrderRef.current}`）；文案 `Project/config/messages.ts:1673-1675`（`resetBtn`/`resetDone`，未动 ROUTE_RESULT）。
- **验收标准**：调序后按钮可点；点击即还原系统推荐顺序（住宿仍序号 0）；复位期间零网络请求；刷新后草稿保留复位顺序；未调序时按钮禁用。
- **回归建议**：游客三步走查（拖 2 下 → 复位 → 再拖 1 下 → 保存跳登录），Network 面板确认复位 0 请求。**typecheck exit 0 与 `/try/result` 200 已实测；真实拖序交互未覆盖（无 playwright，待用户走查）**。会员结果页同款见 F-14b（T-006，已实施）。

### F-14b 一键复位 · 普通/会员结果页（PRD F-50 / T-006，2026-10-21 实施，**待用户人工走查**）
- **口径（方案 B，用户裁决）**：复位 = 界面还原 + 经既有 `saveOrder` 防抖 PUT 落库一次（PUT 只写 route_places，**不消耗高德额度**）；不调 syncRoute、不触发系统重排、无新增 fetch。与游客页「零请求」口径不同，因本页拖拽本身即自动落库（既有行为）。
- **证据**：`Project/components/route/RouteResultClient.tsx:732-737`（`initialOrderRef` 快照 ref：days/legs/startIds/estimated）、`:941-953`（快照写入点 = syncRoute 竞态守卫 `:920` 通过后且 `reorder===true`，覆盖 boot `:967` 与切出行方式 `:1566` 两个系统重排入口；movePlace/optimizeDay/pickStart 手动调序不更新）、`:1025-1027`（渲染期派生 `orderDirty`，`orderKeyOf` `:278-281` 比对，不加 state）、`:1033-1043`（`resetOrder()`：还原 localDays/dayLegs/customStartIds/estimated → `reqRef` 作废在途 → 调既有 `saveOrder()` 一次 → `showNavTip` 反馈；函数体零 fetch）、`:1606-1613`（列表头行常驻按钮，`disabled=!orderDirty || navBusy || orderState==='saving' || 无快照`）；文案复用 `MESSAGES.TRY.RESULT.resetBtn/resetDone`（messages.ts 零改动）。
- **验收标准**：未调序按钮禁用；调序后可用；复位后顺序=进页系统顺序（含住宿点/出发点）；复位不触发重排；复位落库一次（重进页面顺序保持）。
- **回归建议**：登录打开任一路线 → 拖 2 下 → 复位 → 顺序回初始且列表头出现「已保存」；**typecheck exit 0、next build webpack 编译通过、dev 路由 307 登录墙符合预期已实测；登录态渲染与真实拖序交互未覆盖（无测试账号/playwright，待用户走查）**。

## 2. 部分实现（代码在，开关/配置/外部条件未满足）

### F-20 企业微信自建应用消息通道
- **证据**：代码完整（`Project/lib/order-notify.ts:100-143`，`gettoken`、`agentid :143`、启用条件三项齐全 `:167`）；`WECOM_CORP_ID/APP_SECRET/AGENT_ID/TOUSER` 4 变量未配置（`docs/人工参数与环境配置.md` §6）→ 通道关闭。
- **验收标准**：配置三项后消息可发出；当前环境预期行为 = 不发送、不报错。
- **回归建议**：上线备案域名+固定 IP 后再验（errcode 60020 前置）；当前仅验证「未配置时下单流程不受影响」。

### F-21 高德 Web Key 池第 3 槽
- **证据**：代码支持（`Project/config/env.ts:28`）；`.env.local` 缺 `AMAP_WEB_SERVICE_KEY_3` → 实际 2 槽。
- **验收/回归**：补配后 `amap_usage.key_slot` 应出现 2 号槽记录。

### F-22 文案导入 · 第三方分享链接解析
- **证据**：`Project/lib/link-fetch.ts:145`(`fetchTextFromUrl`)、`:24/:30/:34`；接口 `Project/app/api/ai/extract/route.ts:29` 与游客侧 `Project/app/api/try/extract/route.ts:47` 均支持链接输入。
- **限制**：小红书/大众点评等平台登录墙导致链接抓取大概率失败，回退引导粘贴正文（历史教训 + `Project/lib/link-fetch.ts` 结构）。粘贴文案路径稳定可用。
- **回归建议**：分别提交小红书分享链接与纯文本笔记正文，验证前者回退提示、后者正常提取。

### F-23 国内生产部署
- **证据**：当前运行形态 = Windows 宿主机 Docker 自建 Supabase + 本机 dev（`docs/progress.md`）；无任何部署产物/流水线存在。用户硬性要求「必须国内」为约束事实，实施状态 = 未开始（见 F-40）。
- **回归建议**：不适用（无代码）。

## 3. 仅界面（UI 在、能力受限或与普通页分叉）

### F-30 游客第 2 步勾选页（TryPickClient）
- **证据**：`Project/components/try/TryPickClient.tsx`(572 行) 界面与普通页 `Project/components/route/RoutePlacesClient.tsx`(526 行) 对齐（页头统计/筛选 tab/全选/侧栏），但为**第二套独立实现**：`filterTabCls :60/:46`、`pickCls :62/:48`、`typeIconCls :66/:52` 各写一份。
- **风险**：功能可用但双实现分叉（known-issues A4；历史上已因分叉出过 4 个真人实测 bug）。
- **回归建议**：任何勾选页改动需两文件同步人工核对（当前无共享机制可依赖）。

## 4. 仅接口（API 存在、前台入口受限或被开关挡）

### F-35 `POST /api/member`（直接开通会员）
- **证据**：`Project/app/api/member/route.ts:18`；`ENABLE_REAL_PAYMENT=true` 时恒 400（`:28-33`），设计上仅供后台/内部调用，前台无直接入口（正常购买走 F-06 订单流）。
- **回归建议**：确认收银台不依赖该接口；后台直授走 `/api/admin/member`。

### F-36 ~~`POST /api/amap/search`（POI 搜索代理）~~ → **已删除（T-001，2026-10-21）**
- **证据**：原 `Project/app/api/amap/search/route.ts:9`；全仓无调用方（阶段 2 审计 + Q-001 实测），属死接口；且无鉴权（见 F-50）。
- **处置**：按 D-010 决策，目录已整体删除；匿名 POST 实测 404。

## 5. 有缺陷（当前行为与既定口径不符，已记录待修）

### F-50 两个高德代理接口无鉴权（known-issues A5）→ **已修复（T-001，2026-10-21，待用户人工验收）**
- **证据**：修复前 `Project/app/api/amap/search/route.ts:10` 与 `Project/app/api/amap/landmarks/route.ts:27` 全文无 `auth.getUser`、无 `checkGuestRateLimit`（本轮鉴权矩阵 getUser=0/admin=0/guestRL=0）；`Project/middleware.ts:25-50` 的 `PROTECTED_ROUTES`（`Project/config/routes.ts:56`）不覆盖 `/api/*`，未匹配路径直接放行（`:53`）。
- **后果**：匿名可刷，消耗高德 Web 服务额度（landmarks 仅受整体熔断 `isAmapQuotaCritical` 约束）。
- **处置状态**：**已执行**——`/api/amap/search` 整目录删除（匿名 POST 实测 404）；`/api/amap/landmarks` 在读取 body 前加 `createClient()+auth.getUser()`，未登录返回 401 + `MESSAGES.LOGIN_FIRST`（实测匿名 401）。熔断/缓存/返回结构未动。
- **回归建议**：登录用户打开 `/route/[id]` 点「周边知名地点」懒加载应正常（200，本轮无测试账号未执行，由用户人工验收）。

### F-51 重复实现导致的口径漂移风险（known-issues A4 + module-map §4.3）
- **证据**：`straightMeters`/`estimateLeg` 两份（`Project/app/api/amap/route/route.ts:29/:43` vs `Project/app/api/try/order/route.ts:50/:64`）、`localDayString` 三份（`Project/lib/member-quota.ts:148`/`Project/lib/guest-rate-limit.ts:37`/`Project/lib/amap-usage.ts:81`）、`fmtTime` 五份、`SortablePlaceRow` 两份。
- **后果**：改一处漏其余 → 距离/时区/格式口径不一致（缺陷温床，非当前已知故障）。
- **回归建议**：涉及距离估算或日期口径的改动，grep 全部同名实现逐一核对。

## 6. 未实现（明确不存在，均有实测证据）

| # | 项 | 证据 |
|---|---|---|
| F-40 | 生产部署（任何环境） | 无部署配置/流水线；当前仅本机 dev（`docs/progress.md`） |
| F-41 | 自动化测试框架 | 无 jest/vitest/playwright，`Project/package.json` scripts 无 test；`find` 0 文件 |
| F-42 | CI/CD | 无 `.github/` 目录 |
| F-43 | 短信提醒通道 | grep 全项目无代码（历史决策记录为「口头预留」） |
| F-44 | 付款全自动回调 | 个人收款码无官方回调 API（历史教训）；仅 F-06 半自动 |
| F-45 | 服务端定时任务/事件队列 | `docs/module-map.md` §1.6 实测 0；`setInterval` 全在浏览器端 |
| F-46 | 年卡/永久会员购买 | `Project/config/business.ts:145` `MEMBER_PLANS` 仅月卡；`Project/config/enums.ts` E25 保留 year/forever 仅用于历史订单展示 |

## 7. 证据来源

- 本轮全文读取：25 份 `Project/supabase/migrations/*.sql`、30 个 `Project/app/api/**/route.ts`（3 个 Explore 子代理 + 主会话补读 13 文件）、`docs/module-map.md` 448 行、`docs/known-issues.md`、`docs/open-questions.md`、`docs/progress.md`。
- 已产出的细节文档：`docs/data-model.md`（字段/触发器行号）、`docs/api-contract.md`（33 handler 鉴权矩阵）。
- 命令实测：`find Project/app -name ...`（入口计数）、`grep -rn "lib/supabase" Project/components`（无匹配）、`codegraph callers limitsOf/checkGuestRateLimit/orderByMatrix`（CLI）、`npm run typecheck` EXIT=0（`docs/setup-and-run.md`）。
- Harness 实测数据库事实：14 表行数、RLS 匿名 0 行（`docs/open-questions.md` Q-101/Q-102，直接采信）。

## 8. 待确认事项

1. F-01~F-13 的「历史人工验证记录」来自 project_memory 与 `File-PRD/` 历史文档，本轮未重新逐项真人复测；运行时行为最终需用户走查（AGENTS.md §4「未覆盖」口径）。
2. 「仅界面/仅接口」分级依赖调用方检索，动态拼接的 fetch 路径（如模板字符串变量）可能漏检 [未知]。
3. F-22 链接解析对具体平台（大众点评/马蜂窝）的实际成功率未在本轮实测 [未知]。
4. `Project/public/750x750png`（无扩展名残留）用途不明，未计入任何功能 [未知]。
5. 分享页「零高德调用」仅静态确认（`Project/app/share/[token]/page.tsx` 无 amap 导入），运行时网络面板未抓包核对 [高度可能]。
