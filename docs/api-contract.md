> 状态：已核对（Harness 2026-10-21 00:10 复核：结构、鉴权口径、数据模型均与代码/库一致；偏差记入 known-issues B9）

# API 契约（阶段 4 · 反向恢复）

> 覆盖 `Project/app/api/` 下全部 **30 个 route 文件、33 个导出 handler**（方法清单 grep `export async function` 实测）。鉴权口径：`getUser` = handler 内调 `supabase.auth.getUser()`；`admin` = 服务端二次查 `users.role`（/api/* 不在 `Project/middleware.ts` 守卫范围内，middleware 只管页面，见 `Project/middleware.ts:25-51`）；`桶` = `Project/lib/guest-rate-limit.ts:109` `checkGuestRateLimit` 的五个游客限流桶之一。行号证据来自本轮逐文件读取（3 个只读子代理 + 主会话补读 13 个文件交叉核对）。

## 1. 认证（Project/app/api/auth/）

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 1 | POST /api/auth/login | 无（公开） | body: email, password, admin?(bool，管理端入口) | `{ok, redirect}` | 401 密码错 / 503 连接失败 / 403 邮箱未确认（三类分提示，`route.ts:16-80`）；admin=true 但 role≠admin → 403+登出 | 写会话 cookie；admin 标志额外查 users.role |
| 2 | POST /api/auth/logout | 无（依赖 cookie 会话） | 无 body | `{ok, message, redirect}`（`Project/app/api/auth/logout/route.ts:7-11`） | 无 | `signOut()` 清 cookie；前端按身份跳 /login 或 /admin/login |
| 3 | POST /api/auth/register | 无（公开） | body: email, password, redirect? | `{ok, needConfirm:false, message, redirect}`（`route.ts:78-83`） | 400 参数/密码短（:27-41）/邮箱已存在/发信失败（:51-63 映射中文文案）；500 会话写入失败（:74-76） | **service_role** `admin.auth.admin.createUser(email_confirm:true)` 绕过自建版缺 SMTP（:44-49，注释 :14-18 标注上线接 SMTP 后应改回）；upsert users 档案（:66-70）；注册即登录（:73） |
| 4 | POST /api/auth/reset-password | 无（公开） | body: email, password | `{ok, message}`（`route.ts:60-120`） | 429 IP 滑动窗口超限 / 403 管理员禁止自助 / 404 用户不存在 / 500 更新失败 | 仅改密码不动其他字段；成功后 `notifyPasswordReset` 推企微提醒（三道保护实测在位） |

## 2. AI 提取与地点（登录侧）

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 5 | POST /api/ai/extract | 登录按档位配额；**未登录走 ai-extract 桶**（`Project/app/api/ai/extract/route.ts:94-118`） | body: text 或 url 二选一（混输会抓链接合并，:44-59） | `{ok, city, places, linkReadFailed}`（:127） | 400 空/超长（:69-74）/ 422 LINK_NEED_TEXT（:61-67）/ 429 登录档 AI_EXTRACT_DAILY_LIMIT（:100-108，免费 10 会员 20 admin 不限）/ 429 游客桶（:114-117）/ 502 DeepSeek 失败（:128-130） | 调 DeepSeek `extractPlacesAndCity`（先识别城市再归集）；成功才 `bumpDailyUsage`（:124-126）；访客补发标识 cookie（:88-92） |
| 6 | POST /api/places | getUser 401（`Project/app/api/places/route.ts:88-95`） | body: routeId?/cityId?/cityName?/source/rawText?/items[] | `{ok, inserted, skipped, cityMatched}` | 400 参数非法 / 500 写库失败 | 写 places（按识别城市建收藏夹归集）；调高德 place/text 补坐标（命中 023 缓存）；写 imports 记录 |
| 7 | DELETE /api/collected | getUser 401（`Project/app/api/collected/route.ts:14-21`） | query: placeId | `{ok}` | 400 缺 placeId（:24-26）/ 500（:36-38） | **软标记** `is_collected=false` 不删行（:30-34，避免 route_places 级联，012 迁移设计） |
| 8 | POST /api/collected | getUser 401（:43-50）+ 档位单日上限 | body: placeId, routeId | `{ok, dayIndex}`（:140） | 400 缺参/超 30 上限（:60-61/:96-101）/ 404 不在收藏或路线非本人（:72-85）/ 409 已在路线（:93-95）/ 403 单日满 QUOTA_ERROR.PLACES_PER_DAY_LIMIT（:116-125，`limitsOf(tier).placesPerDay` :105-106） | 写 route_places（排进第一个有空位的天） |

## 3. 路线（Project/app/api/routes/）

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 9 | POST /api/routes | getUser 401（`route.ts:24-30`）+ `limitsOf` 配额 | body: title/cityId/days/transport/origin_city/lodging 系列/places[] | `{ok, id}`（:94-119） | 401 / 403 免费多日无试用额度 / 429 日/月路线额度尽（:68-90） | 插 routes；非 admin 成功后 `consumeRouteQuota`（:94-119，写 user_daily_usage） |
| 10 | PATCH /api/routes/[id] | getUser 401（`[id]/route.ts:10-17`） | body: 出行设置字段子集 | `{ok}` | 401/400/404 非本人 | 校验归属后 update routes（:31-51） |
| 11 | PUT /api/routes/[id]/places | getUser 401（`places/route.ts:26-33`）+ 单日上限 | body: days 数组（placeId 列表） | `{ok, count}`（:106-128） | 401/400/403 超 `limits.placesPerDay`（:69-91）/404 | **先删旧 route_places 再整批插入**（:106-128，保存前校验数量一致性） |
| 12 | POST /api/routes/[id]/share | getUser 401（`share/route.ts:40-47`） | 无 body | `{ok, token, url, snapshot}`（:79-98） | 401/404/500 | **作废旧令牌**（revoked_at）→ 插 route_shares 新令牌+快照（:79-98） |
| 13 | DELETE /api/routes/[id]/share | getUser + 归属（:104-140） | 无 | `{ok}` | 401/404 | update route_shares.revoked_at |

## 4. 分享导入

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 14 | POST /api/shares/[token]/import | getUser；**免费用户 403 不可导入**（`import/route.ts:16-30`） | 无 body（token 在路径） | `{ok, imported}` | 401/403/400 snapshot 校验失败/404 令牌无效（:40-55） | **service_role** 读 route_shares 快照（:40-55）；写 places/route_places 到导入者账号 |

## 5. 会员（Project/app/api/member/）

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 15 | POST /api/member | getUser 401（`route.ts:18-25`） | 无 body | — | **ENABLE_REAL_PAYMENT=true 时恒 400 errUseOrderFlow**（:28-33，旧模拟路径 :35-60 现不可达） | （关闭态）写 users.member + member_logs |
| 16 | POST /api/member/orders | getUser（`orders/route.ts:28-107`） | body: plan, pay_channel, pay_note? | `{ok, orderId}` | 400 套餐/通道非法或已有待核销单（校验 pending 数）/ 500 | **service_role** 写 member_orders，amount_cents 服务端按套餐取（不信任前端）；调 `notifyOrder` 推企微（群机器人 Webhook + 自建应用双通道 `Project/lib/order-notify.ts:166-167`） |
| 17 | GET /api/member/orders | getUser | 无 | 本人订单列表 | 401 | 读 member_orders |
| 18 | GET /api/member/orders/status | getUser 401（`status/route.ts:24-31`） | 无 | `{ok, order, member, memberUntil}`（:49-54） | 500（:45-47/:55-56） | **service_role** 读最近一单 + users.member/member_until；惰性到期判定 `isMemberActive`（:18-22）；供收银台轮询感知核销 |

## 6. 高德代理（Project/app/api/amap/）

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 19 | POST /api/amap/route | getUser 按 tier 分流（`route/route.ts:52`） | body: points[]/mode/cityAdcode? | `{ok, mode, order, legs, distanceMeters, durationSeconds}` | 502 整体失败；单段失败降级直线估算（`estimateLeg` :43-50） | cachedDistanceMatrix+orderByMatrix（`Project/lib/route-order.ts:173`）+逐段算路；读写 amap_leg_cache；Key 池计数 |
| 20 | POST /api/amap/order | getUser + 配额 profile（`order/route.ts:21-59`） | body: points/mode | `{ok, mode, order}` | 502 矩阵失败 | **免费/游客用直线伪矩阵，会员/管理员用高德真实距离矩阵**（tier 分流） |
| 21 | POST /api/amap/landmarks | **无鉴权**（`landmarks/route.ts:27`，grep getUser=0） | body: points/excludeNames | `{ok, items, quotaCritical}` | 400；查询失败返回 200 空结果 | 高德周边搜（评分前 8，商场/商业街/风景名胜）；结果缓存 |
| 22 | POST /api/amap/search | **无鉴权**（`search/route.ts:9`，grep getUser=0） | body: keywords, city | `{ok, results}` | 404 无结果 / 429 额度限流 / 502 失败 | 高德 place/text（命中 023 缓存） |

> #21/#22 即 known-issues A5。**已决策（Q-001，用户 2026-10-21）**：#22 删除（grep 全项目零调用方）；#21 加 getUser。代码现状仍无鉴权，改动排入阶段 7。[已确认]

## 7. 游客试用（Project/app/api/try/）

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 23 | GET /api/try/city-places | **city-places 桶 100/日**（`city-places/route.ts:33-38`） | query: cityId/cityName | `{ok, items}`（:47-90） | 429 超限 | **service_role 跨用户读** places（is_collected=true 且坐标非空，去重过滤排序），零高德消耗 |
| 24 | POST /api/try/extract | **import 桶 3/日**（`extract/route.ts:47-52`） | body: text/url | `{ok, places, failed}`（:119-156） | 429 / 400 / **409 CITY_MISMATCH 识别城市与当前城市不一致**（:95-112） | DeepSeek 提取 + 高德 searchPlaces 补坐标（无坐标丢弃）；不落库（游客无账号），结果进 sessionStorage 草稿 |
| 25 | POST /api/try/order | **manual=true → reorder 桶 60/日；否则 order 桶 3/日**（`order/route.ts:102-108`） | body: points[](2-6 个)/mode/cityAdcode?/manual?/lodging? | 排序后顺序 + 分段 legs/distanceMeters/durationSeconds | 400 点数越界（:124-126）/ 429（:107-109） | 非 manual 且 ≥3 点：cachedDistanceMatrix+orderByMatrix 重排（:175-188）；manual 保持传入顺序只算分段；planDayRoute→planLeg→直线兜底（:188-225）；新访客补 cookie（:111-116） |
| 26 | POST /api/try/promote | getUser 401（`promote/route.ts:54-61`）+ 配额 | body: 草稿（城市/设置/points 顺序/lodging） | `{ok, routeId}`（:223-268） | 401 / 429 路线额度 / 403 单日地点超限（:151-170） | 创建 routes + route_places **落库转正**，失败回滚；成功后 consumeRouteQuota；导入地点归入该用户收藏 |

## 8. 管理端（Project/app/api/admin/）

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 27 | POST /api/admin/member | getUser 401 + role=admin 403（`member/route.ts:13-25`） | body: userId, grant(bool)（:34-37） | `{ok}` | 400 grant 非 bool / admin 目标拒绝操作（:50-52）/ 404（:46-48）/ 500 | **service_role** update users（member 系列，grant 时 member_until=null 永久，:55-65）+ insert member_logs（:70-75，无 insert 策略必须 Secret Key） |
| 28 | GET /api/admin/member/orders | getUser + admin 403（`orders/route.ts:14-26`） | 无 | 订单列表（待核销优先，join 邮箱） | 401/403 | service_role 读 member_orders（:28-67） |
| 29 | POST /api/admin/member/orders/[id] | getUser + admin 403（`[id]/route.ts:21-33`） | body: approve(bool), reason?（:40-52） | `{ok}` | 400/403/404/500 | approve → 目标用户置会员 + 写 member_logs（:67-106）；reject → status=rejected+reject_reason；service_role |
| 30 | GET /api/admin/member/orders/pending-count | getUser + admin 403（`pending-count/route.ts:15-27`） | 无 | `{ok, pending}` | 401/403 | service_role `count(head:true)` filter status=pending（:29-37）；供侧边栏红色角标 |
| 31 | DELETE /api/admin/users/[id] | getUser 401 + admin 403（`users/[id]/route.ts:14-27`） | 路径 id | `{ok, message}` | 400 删自己/删管理员（:33-35/:48-50）/ 404（:44-46）/ 500 | `admin.auth.admin.deleteUser`（:52-55）级联清 users 及名下数据；注释 :23 明确「/api 不在 middleware 守卫范围」 |
| 32 | POST /api/admin/seed-demo | getUser + admin（`seed-demo/route.ts:77-80`） | query: ?cities=成都,重庆 可选（:13） | 补数统计 | 401/403/400 | 高德拉「风景名胜 8 + 美食 6」/城写 places（is_collected=true 归管理员，:16-18）；串行 ≥350ms + Key 池 + 30 天缓存（:20-21）；**显式 1000 行分页防 PostgREST 静默截断**（:42-61）；maxDuration 800（:40） |

## 9. 其他

| # | 方法 路径 | 鉴权 | 入参 | 出参要点 | 错误码 | 副作用 |
|---|---|---|---|---|---|---|
| 33 | POST /api/heartbeat | getUser 401（`heartbeat/route.ts:5-13`） | body: path?（空 body 合法，:16-21） | `{ok}` | 500（:28-30） | update users.last_seen_at/current_path（:23-26）；前端定时器 ≥30s |

> 33 个 handler 分布在 30 个文件（#16/#17 同文件、#7/#8 同文件、#12/#13 同文件）。

## 10. 鉴权总口径

- middleware 只守页面：`Project/middleware.ts:25-51`（登录页/`/try/*` 公开，`/admin/*` 需 role=admin，PROTECTED_ROUTES 需登录），**不覆盖 /api/***，管理接口全部在 handler 内二次校验。[已确认]
- 游客五桶定义：`Project/lib/guest-rate-limit.ts:99` `dailyLimitOf`；额度常量 `Project/config/business.ts:72/:79/:85`。计数为**进程内 Map，不持久**（重启归零、多实例不共享，known-issues A2/B2）。[已确认]
- service_role 使用面：注册建号、订单写入与核销、分享读写、游客读库内地点、缓存/用量/配额 rpc——即 known-issues A3「绕 RLS 面」的全部入口。[已确认]

## 证据来源

- 30 个 route 文件本轮逐行读取：3 个只读子代理覆盖 20 个文件 + 主会话补读 13 个文件（logout/register/orders/status/admin.member/admin.users/heartbeat/member/ai.extract/collected/seed-demo 等），方法清单以 grep `export async function` 实测（33 处）。
- `Project/middleware.ts` 全文、`Project/lib/guest-rate-limit.ts:99/:109/:113`、`Project/config/business.ts:72-89`、`Project/lib/member-quota.ts:90/:170/:192`、`Project/lib/order-notify.ts:166-167`。
- 决策记录：`docs/open-questions.md` Q-001（A5 处置）、`docs/known-issues.md` §0（Harness 复核）。

## 待确认事项

1. #21/#22 无鉴权的**线上暴露面**：dev 环境无碍，上线前必须完成 Q-001 处置（阶段 7），当前文档只描述现状。
2. #19/#20 免费档「直线伪矩阵」与会员「真实矩阵」的 tier 判定入口（`getQuotaProfile`）在 `Project/lib/member-quota.ts`，分流行号未逐一摘录，引用时以该文件为准。
3. 各接口错误文案集中在 `Project/config/messages.ts`（MESSAGES 常量），本契约只写状态码不逐条抄文案。
4. POST /api/places 的 items 子字段结构（name/type/address…）以 `Project/types/place.ts` 与 handler :97-104 的 body 类型为准，未展开到叶子字段。
5. 分享导入 #14 的「免费不可导入」具体判定行（tier 比较）未逐行摘录，[已确认] 存在、细节待 Harness 抽查。
