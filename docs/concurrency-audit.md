# 幂等与并发审计报告（T-011，只读）

> 审计时间：2026-10-22（本机）。执行方：Trae（GW-TASK tj_20261022-122846_1rry）。
> 方法：读接口实现 + 迁移 SQL + 前端调用点（rg 全量 + CodeGraph `saveOrder` blast radius 确认）+ 自建 Supabase `/pg/query` **只读**查系统表（pg_constraint / pg_indexes / pg_trigger）验证真实库约束。
> 零源码改动、零写库、零压测。任务卡：`tasks/T-011.md`。
>
> **通用结论先行**：全链路（下单 / 核销 / 建路线 / 保存点位）均为「应用层先查后写（check-then-act）」，**无一处数据库层唯一约束或 CAS 条件更新兜底**；数据库实测确认 `member_orders`、`route_places`、`routes` 上除 PK / FK / CHECK（值域）外没有任何 unique 索引，`member_orders` / `route_places` / `routes` 上没有任何业务触发器（pg_trigger 实测仅 `users` 表有 3 个）。前端各提交按钮均有同标签页 busy 防连点，但**跨标签页 / 多设备 / 网络重试不受前端保护**。

标记口径：`[已确认]`=代码+库双层证据；`[高度可能]`=代码证据充分但真实并发未实测（任务禁止压测）；`[风险]`=需排期修复。

---

## 1. 会员下单重复提交 `POST /api/member/orders`

- **场景**：同一用户连点「提交订单」，或两个标签页 / 两台设备同时提交。
- **现状**：
  - 服务端 `Project/app/api/member/orders/route.ts:65-72`：先 `count` 该用户 `status=pending` 的订单数，`>= BUSINESS.MAX_PENDING_ORDERS`（`Project/config/business.ts:155`，值=2）则拒绝，否则 `:74-85` 直接 insert。**查与写非原子，无事务、无幂等键**。
  - 前端 `Project/components/profile/MemberCard.tsx:117-141`：`submitOrder` 进入即 `setBusy(true)`，按钮 `disabled={busy}`（`:450/:458/:477/:485`）——只挡同标签页连点。
- **数据库层**：迁移 `Project/supabase/migrations/021_member_paid_and_share.sql:31-47` 建表只有 `status CHECK (pending/approved/rejected)` + FK；`/pg/query` 实测（2026-10-22）`member_orders` 的 pg_constraint 仅 `pkey + 4 CHECK + 2 FK`，pg_indexes 仅 `member_orders_pkey` + 2 个普通索引——**没有任何能阻止重复 pending 的约束**。
- **结论**：**有风险** `[已确认]`（机制）/ `[高度可能]`（并发后果，未压测）。
- **证据**：上列 文件:行 + `/pg/query` 三条系统表查询输出（HTTP 200）。
- **后果**：并发窗口内两请求都看到 count=0 → 各插一笔；上限 2 是软限制，真并发可产生 >2 笔 pending。用户若对多笔订单都实际付款，管理员可能核销多笔（见第 2 项），对账混乱 + 企微提醒重复推送（提醒在下单时发，`route.ts:92`）。
- **最小修复建议**（不在本任务实施）：部分唯一索引 `create unique index on member_orders (user_id) where status = 'pending'`（若保留「最多 2 笔」口径则改 advisory lock 或事务 RPC 完成 check+insert）；应用层把「已有 pending 则拒绝」改为依赖索引冲突返回 400。

## 2. 核销重复点 `POST /api/admin/member/orders/[id]`

> 注：任务卡写 PATCH，**实际实现与调用方均为 POST**（`route.ts:21`、`Project/components/admin/AdminOrdersClient.tsx:94`），以代码为准。

- **场景**：管理员连点「确认开通」，或两个管理员 / 两个标签页同时核销同一订单。
- **现状**（`Project/app/api/admin/member/orders/[id]/route.ts`）：
  - `:53-63` 读订单，`status !== 'pending'` → 400。**这是普通 SELECT，不是条件更新**；
  - `:85` `memberUntil = Date.now() + plan.days*DAY_MS`——**覆盖式**写入（非在现有到期日上累加）；
  - `:87-95` update users、`:101-106` insert member_logs、`:108-116` update 订单为 approved——update 条件只有 `.eq('id', order.id)`，**没有 `.eq('status','pending')` CAS**；三步无事务。
  - 前端 `AdminOrdersClient.tsx:90` `setBusyId(order.id)`，按钮 `disabled={busyId === o.id}`（`:237/:245/:324/:332`）——只挡同标签页。
- **数据库层**：`/pg/query` 实测 `member_orders` **无触发器**（pg_trigger 仅 users 表 3 个）、无状态相关 unique 约束；状态机「pending→approved 一次」只靠应用层读检查。
- **结论**：**有风险** `[已确认]`（机制）/ `[高度可能]`（并发后果）。
- **后果**：并发双核销同一订单 → `member_logs` 落两条 GRANT 留痕、`users.member_since` 被刷两次；`member_until` 因覆盖式写法**不会**翻倍时长（这是当前唯一的天然减损）；订单终态仍是 approved（幂等）。企微通知不在核销链路（只在下单 `orders/route.ts:92`），**「重复发企微通知」不存在**。
- **最小修复建议**：把 `:108-116` 改为 CAS——`.update(...).eq('id', order.id).eq('status', PENDING).select()`，返回 0 行即视为已被他人核销、直接返回 409 且**不再执行** users update 与 member_logs insert（即把状态翻转挪到最前作为闸门）；长期可加 DB 触发器禁止 approved/rejected 改回 pending。

## 3. 保存路线「先删后插」 `PUT /api/routes/[id]/places`

- **场景**：同一路线两个并发 PUT（多标签页编辑、拖序后快速切页再保存、前端重试）。
- **现状**（`Project/app/api/routes/[id]/places/route.ts`）：
  - `:13` 注释自认「Supabase JS 无事务，按此顺序执行」；`:106-112` `delete().eq('route_id')` 全删，`:114-126` `insert` 新清单。**删与插之间无任何隔离**。
  - 前端防「删一半」护栏：`Project/components/route/RouteResultClient.tsx:757-765`（页面地点数 ≠ totalPlaces 时拒绝回写）——只防漏点，不防并发。
- **数据库层**：迁移 `005_create_route_places.sql:5-16` 只有 PK(id) + 2 个普通索引；`/pg/query` 实测 `route_places` **无 unique(route_id, place_id)**、无触发器——并发交错时数据库不会拦重复行。
- **结论**：**有风险** `[已确认]`。
- **后果**（两种交错时序）：
  - `A.del → A.ins → B.del → B.ins`：B 覆盖 A，A 的编辑**静默丢失**（last-writer-wins，无版本号可比对）；
  - `A.del → B.del → A.ins → B.ins`：A、B 两份清单**共存** → route_places 出现重复地点、order_index 冲突，地图与分段里程错乱，且没有约束能阻止落库。
- **最小修复建议**：SQL RPC 事务函数（同一函数内 delete+insert，Postgres 保证原子）；加 `create unique index route_places_route_place_key on route_places (route_id, place_id)` 兜底；进阶：routes 加 `updated_at` 乐观锁，PUT 带基线版本、不匹配回 409。

## 4. 新建路线连点 `POST /api/routes`

- **场景**：连点「下一步/创建」，或两标签页同时提交同一表单。
- **现状**（`Project/app/api/routes/route.ts`）：`:86-92` `getRouteQuota` 读余额 → `:94-105` insert routes → `:112-114` `consumeRouteQuota` 计数。**检查与写入非原子**；无幂等键、无去重窗口（与 promote 不同，这里连 15 秒内存去重都没有）。计数本身原子（`Project/lib/member-quota.ts:184-202` → rpc `bump_user_daily_usage`，迁移 `020_member_quota.sql:49-64` on conflict do update，PK(user_id,day,kind) `/pg/query` 实测在），但「读余额→建路线」窗口内两请求可双双通过。
- **前端**：`Project/components/route/RouteNewClient.tsx:155` `setSubmitting(true)`、按钮 `:483 disabled={submitting}`——只挡同标签页。
- **数据库层**：`routes` 无任何去重约束（实测）。
- **结论**：**有风险** `[高度可能]`（跨标签页/多设备）。
- **后果**：重复路线两条 + 配额双扣；免费档（每天 1 条）并发下可变 2 条（超额 1 笔，成本=高德算路额度）。
- **最小修复建议**：同第 3 项思路——RPC 事务内「锁行读余额→insert→bump」；或接受现状但在文案/对账上明确「并发窗口可能超 1 条」。

## 5. 游客转正连点 `POST /api/try/promote`

- **场景**：登录后在 `/try/result` 连点「保存这条路线」。
- **现状**（`Project/app/api/try/promote/route.ts`）：
  - 有服务端短期幂等：`:51-52`（15 秒窗口 + 进程内 Map）、`:140-149`（同用户同签名命中即复用 routeId）、`:266`（**成功后才写入**去重表）。
  - **关键缺陷**：`:266` 在全部落库（`:196-221` places 循环 insert、`:227-240` routes insert、`:253` route_places insert，多次网络往返）之后才登记。第一个请求未完成时到达的第二个请求 miss → 各建一条。即该幂等只防「完成后的快速重试」，**不防真并发**。
  - 进程内 Map 跨实例无效（与 `docs/known-issues.md` B2 同根因）。
  - 前端：`Project/components/try/TryResultClient.tsx:509` `if (!latest || saving) return` + `:511 setSaving(true)`，按钮 `:759 disabled={saving}`；成功后 `:542-543` 清草稿并跳转，同标签页保护完整。
- **数据库层**：`routes`/`places` 无去重约束（实测；places 去重仅应用层 `:182-194` find-or-create）。
- **结论**：**有风险（并发窗口）** `[已确认]` 机制存在窗口 / `[高度可能]` 实际触发——前端 busy + 成功即跳转使真实概率低。
- **后果**：窗口内双请求 → 两条路线 + 配额双扣（口径同第 4 项）。
- **最小修复建议**：入口先占位——`recentPromotions.set(user.id, {signature, routeId: 'PENDING', at})` 存 in-flight Promise，并发请求 await 同一 Promise 复用结果；或按第 4 项走事务 RPC。

## 6. 多标签页编辑同一路线（`saveOrder` 600ms 防抖）

- **场景**：两个标签页同时打开 `/route/[id]` 拖序。
- **现状**（`Project/components/route/RouteResultClient.tsx`）：
  - `:741` `saveTimerRef` 是 **useRef（组件实例级）**，`:744-775` 防抖 600ms 只合并**本标签页**的连续拖序；`:766-773` 每次到期即全量 PUT。
  - 组件内 `saveOrder` 共 4 个调用点（`:813` 拖序、`:847` 住宿变更、`:967` 切出行方式后、`:1041` 复位——CodeGraph blast radius 与 rg 双确认）。
  - 标签页之间零协调：无 BroadcastChannel、无 storage 事件、无乐观锁。
- **结论**：**有风险** `[已确认]`（与第 3 项同根因：先删后插 + 无版本）。
- **后果**：后保存的标签页整体覆盖先保存的（先者编辑静默丢失）；交错时序产生重复 route_places 行（见第 3 项）。单标签页内防抖正常工作时不会互相覆盖。
- **最小修复建议**：同第 3 项（事务 RPC + unique 索引 + 乐观锁）；可选加 BroadcastChannel 提示「此路线已在另一标签页编辑」。

## 7. 游客限流 Map 非原子 `checkGuestRateLimit`

- **场景**：同一游客并发打满 3 次/日的花钱桶（import/order）。
- **现状**（`Project/lib/guest-rate-limit.ts`）：`:31` 模块级 Map；`:122-133` get → 判断 → set 的读改写**全部是同步代码，中间没有 await**。Node 单线程事件循环下，同步函数一旦开始就执行完毕才被切换——**单进程内该「非原子」实际不可被打断，不会多放行**。`:116-120` 过期清理同样同步。
- **调用方**（rg 实测 4 处）：`app/api/try/extract/route.ts:49`（import 桶）、`app/api/try/order/route.ts:106`（order/reorder 桶）、`app/api/ai/extract/route.ts:114`（ai-extract 桶）、`app/api/try/city-places/route.ts:35`（city-places 桶）。
- **结论**：**安全（单进程内）** `[已确认]`；**跨实例/跨重启不准确** `[已确认]`（设计取舍，文件头注释与 known-issues B2 已声明）。
- **影响评估**（任务卡要求评估、不修）：多实例部署时每实例各一份 Map → 花钱桶上限按实例数放大（DeepSeek + 高德成本风险线性增长）；重启清零。当前 dev 单进程 + 生产计划单机，实际敞口小。
- **最小修复建议**（仅备案）：上线多实例前把 import/order 两个花钱桶迁 Redis/DB 计数；只读桶（city-places/reorder）可接受现状。

---

## 0. Harness 复核补充（2026-10-22 12:40）

R1 复核通过，并发现**比"并发覆盖"更严重的后果**：

- `Project/app/api/routes/[id]/places/route.ts:108-121` 的 `.delete()` 与 `.insert()` 是两次独立 PostgREST 请求，**无事务**；
- 若 delete 成功而 insert 失败（网络抖动 / 超时 / 数据非法），接口返回 500，但该路线的 `route_places` **已被清空**——用户路线全部地点丢失；
- 本环境自建 Supabase 有"假死"史（TCP 通但 HTTP 不回），属**真实可触发路径**，不只是理论并发。
- 数据库复核：`pg_indexes` 显示 `route_places` 仅有 `route_places_pkey(id)` 与普通索引 `(route_id, day_index, order_index)`，**无唯一约束**；现网 `dup_groups = 0`（尚未发生数据重复）。

> 结论：R1 的严重度应从「高」上调为「**高（含数据丢失路径）**」，建议优先修复：用单条 SQL 函数做原子替换 + 补唯一约束。

## 风险清单（按严重度排序）

| # | 风险 | 严重度 | 标记 | 入口 |
|---|---|---|---|---|
| R1 ✅已修 | 保存点位先删后插无事务（T-020 迁移 027 已修）：并发覆盖丢编辑 / 交错产生重复 route_places 行（无 unique 兜底） | **高** | `[已确认]` | 第 3、6 项 |
| R2 ✅已修 | 核销无 CAS（T-020 迁移 027 已修）：并发双核销写重复 member_logs、刷 member_since（member_until 覆盖式不翻倍） | 中 | `[已确认]` 机制 | 第 2 项 |
| R3 | 下单 check-then-insert 非原子：并发可突破 MAX_PENDING_ORDERS=2 软上限 | 中 | `[高度可能]` | 第 1 项 |
| R4 ✅已修 | 建路线/转正配额 check-then-act（T-054 迁移 033）：并发窗口超扣 1 条 + 重复路线（promote 有 15s 去重但不覆盖 in-flight 窗口） | 低-中 | `[高度可能]` | 第 4、5 项 |
| R5 | 游客限流跨实例/跨重启失准（单进程内安全） | 低（备案） | `[已确认]` | 第 7 项 |

> 数据库层检查结论（`/pg/query` 只读实测）：`member_orders` / `route_places` / `routes` 三表**均无幂等或并发保护所需的唯一约束与触发器**；`user_daily_usage` PK(user_id, day, kind) + `bump_user_daily_usage` 原子累加是全链路唯一在数据库层做对了并发的一处。

## §7 T-054 补充实测：promote 同草稿并发（2026-10-25）

| 项 | 结果 |
|---|---|
| 场景 | 同一草稿 5 个并发 POST `/api/try/promote` |
| 响应 | 5×200，**同一 routeId**；4 个 `deduped=true`，1 个真正创建 |
| 库内 | `routes` 2 → **3**（恰好 +1） |
| 结论 | 内存幂等 + in-flight 登记前置生效，并发不产生重复路线 |

清理：测试路线与本次新建地点已删除。
