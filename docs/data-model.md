> 状态：已核对（Harness 2026-10-21 00:10 复核：结构、鉴权口径、数据模型均与代码/库一致；偏差记入 known-issues B9）

# 数据模型（阶段 4 · 反向恢复）

> 字段级结论全部来自 `Project/supabase/migrations/*.sql`（25 份，1415 行，本轮逐行读取）；表清单与行数采信 Harness 2026-10-20 23:55 直连只读实测（见 `docs/known-issues.md` §0）。迁移是否全部应用到目标库仍未核（Q-002）。

## 1. 总览

- 数据库：**自建 Supabase（Postgres）**，经 PostgREST 暴露；连接地址与密钥见 `Project/.env.example`（变量名口径见 `docs/人工参数与环境配置.md`）。[已确认]
- 表：**14 张**（Harness OpenAPI 实测）。迁移中出现的表与库内 14 张一一对应，无「迁移有表但库里没有」的情况。[已确认]（Harness §0 + `Project/supabase/migrations/` 全量 grep `create table`）
- 权限模型：RLS 全表开启（008 + 各建表迁移）；用户数据按 `auth.uid() = user_id` 隔离；管理员经 `is_admin()` 放行；服务端用 service_role（Secret Key）绕 RLS；缓存/用量/配额 5 张表**只开 RLS 不建策略 = 仅 service_role 可读写**。[已确认]
- 防提权：3 个 BEFORE UPDATE 触发器函数（role / member 系列字段守卫）+ 1 个 admin 会员自动补齐触发器。[已确认]

## 2. 表关系（ER 要点）

```
auth.users ──1:1── users（010 触发器同步）
users ──1:N── places / routes / imports / events / member_orders / member_logs(target_user)
cities ──1:N── places / routes（city_id 可空，on delete set null）
routes ──1:N── route_places ──N:1── places（day_index/order_index 0 基）
routes ──1:N── route_shares（token 主键，快照自包含）
user_daily_usage (user_id, day, kind) 复合主键，无独立 id
amap_usage (day, service, key_slot) 复合主键
```
[已确认]（各建表迁移外键定义：001:5、003:6-7、004:6-7、005:7-8、013:58-65、020:28-34、021:31-42/67-75、019:15-23/41-47、023:14-20、024:15-23）

## 3. 逐表字段定义

### 3.1 users（3 行）
| 字段 | 类型/约束 | 迁移 |
|---|---|---|
| id | uuid PK，FK auth.users on delete cascade | 001:5 |
| email | text unique | 001:6 |
| username | text 可空 | 001:7 |
| role | text not null default 'user'，check in (user, admin) | 001:8 |
| last_seen_at / current_path | timestamptz / text，由 /api/heartbeat 更新 | 001:9-10 |
| created_at | timestamptz default now() | 001:11 |
| member / member_since / member_source | bool default false / timestamptz / text check (self, admin, paid) | 013:41-49 + 021:9-12 |
| trial_multi_day_used | bool not null default false（免费永久 1 次多日试用） | 020:21-22 |
| member_until | timestamptz 可空；**null = 永久会员** | 021:17-18 |

索引：`users_member_idx`（部分索引 where member，013:55）。RLS：本人 select/update + admin select（009:28-39）。触发器：`on_auth_user_created`（010:20-22）、`users_prevent_role_change`（010:44-46）、`users_prevent_member_self_grant`（014:29-31，021:95-113 扩到 5 字段）、`users_admin_default_member`（015:44-48，admin 行 member 强制 true 且不可取消）。

### 3.2 cities（92 行）
id uuid PK / name text not null（unique 索引 002:12）/ adcode text not null 高德编码（unique 002:14）/ created_at。RLS：anon+authenticated 全量可读（009:44-46）——游客态选城市依赖此开放。数据由 011_seed_cities 初始化（92 城，可重复执行 on conflict (name)）。

### 3.3 places（1326 行）
基础列（003:5-18）：id / user_id FK cascade / city_id FK set null / name / address / **type check (attraction, food)** / note / image_url / open_hours / rating numeric(2,1)>=0 / lat/lng numeric(10,6) 带范围 check / source_url / created_at。
扩展列（012:12-27）：**is_collected bool default true**（软收藏：移除收藏不删行，避免 route_places 级联删站点，012:8-10 设计说明）/ **source** text check (xiaohongshu, douyin, manual) 可空 / **geo_status** default 'matched' check (matched, pending, unmatched)。
索引：user_id、city_id（003:21-22）、(user_id, is_collected)（012:30-31）。RLS：本人 CRUD + admin select（009:55-74）。游客试用读的是跨用户 `is_collected=true` 汇总池，经服务端 service_role（`Project/app/api/try/city-places/route.ts:47-90`）。

### 3.4 routes（5 行）
基础列（004:5-12）：id / user_id / city_id / title / **days int check >=1**（上限 MAX_DAYS 应用层校验，004:19）/ **transport check (walk, bike, transit, drive)**（004:10 原 2 值，018:11-14 扩为 4 值）/ **is_public bool default false**（第一版关闭，004:18）/ created_at。
出行设置列（013:10-38）：origin_city text / **intercity_mode** check (hsr, plane, drive, coach, sleeper, none) / **lodging_type** check (hotel, homestay, hostel, relative, other) / lodging_name / lodging_area / **lodging_nights** check 1-30 或 null。
索引：user_id、city_id。RLS：本人 CRUD + admin select（009:77-102）。

### 3.5 route_places（41 行）
id / route_id FK cascade / place_id FK cascade / **day_index >=0、order_index >=0（均 0 基，与前端数组下标一致**，005:3、9-10）/ created_at。索引 (route_id, day_index, order_index)（005:14-15）。RLS 经所属路线归属判断（009:112-156）。

### 3.6 imports（6 行）
id / user_id / raw_text not null / **source check (xiaohongshu, douyin, manual)** / **status check (success, need_text, unrecognized, failed)**（006:9 原两态，013:87-90 扩四态）/ created_at。RLS：本人 CRUD + admin select。

### 3.7 events（42 行）
id / user_id / **event_name check 7 值**（007:7 原 3 值，013:96-102 扩为 add_place, generate_route, click_upgrade, sign_up, collect_add_route, collect_remove, member_change）/ metadata jsonb / created_at。索引 (event_name, created_at desc)。RLS：**仅 insert 本人 + admin select**（009:191-197，前端直插）。

### 3.8 member_logs（3 行）
id / target_user FK cascade / **action check (grant, revoke)** / operator_id FK set null / **source check (self, admin, paid)**（013:63 原两值，021:23-26 扩）/ created_at。RLS：仅 admin select（013:77-79），**无 insert 策略 → 写入统一走服务端 Secret Key**（013:75 注释）。

### 3.9 member_orders（0 行）
id / user_id / **plan check (month, year, forever)** / **amount_cents int check >0（服务端按套餐写入，绝不信任前端**，021:60）/ pay_note / **status check (pending, approved, rejected) default pending** / reject_reason / created_at / reviewed_at / reviewed_by FK set null / **pay_channel check (wechat, alipay) default 'wechat'**（022:8-15）。索引 (user_id, created_at desc)、(status, created_at desc)。RLS：仅 select 本人（021:53-56），写入走 service_role。当前 0 行 = 尚无付费订单（Q-104）。

### 3.10 route_shares（1 行）
**token text PK**（crypto.randomBytes(9) base64url，仅服务端生成，021:84）/ route_id FK cascade / owner_id FK cascade / **snapshot jsonb**（自包含路线快照，不依赖原路线权限，021:85）/ view_count default 0（服务端累加失败静默）/ created_at / **revoked_at**（非空=令牌作废，021:87）。RLS 开启但**不建任何策略 = 仅 service_role**（021:81），分享页由服务端 admin 客户端读取。

### 3.11 amap_leg_cache（503 行）
**复合 PK (mode, from_lnglat, to_lnglat)** / distance_meters / duration_seconds / updated_at。mode 口径：距离矩阵 `dist:<navmode>`，算路 `<navmode>[:cityAdcode]`，两者不共用 key（019:27-28）；from/to 按字符串排序写入，一对地点天然一行（019:29-30）。TTL 见 `Project/config/business.ts` AMAP_CACHE_TTL_DAYS（30 天）。仅 service_role（019:38）。

### 3.12 amap_geocode_cache（228 行）
**PK (city, keywords)** / results jsonb（归一化 POI 数组）/ updated_at。只缓存有结果的关键词，空结果不缓存（023:23）。仅 service_role（023:31）。

### 3.13 amap_usage（15 行）
**PK (day, service, key_slot)**（019:41-47 原 (day,service)，024:15-23 加 key_slot 维度、历史行默认 0）/ calls / failures。service 取值：place_text / distance / direction_* / other（019:51-52）；key_slot = AMAP_WEB_KEYS 槽位下标（024:18-19）。仅 service_role；累加走 `bump_amap_usage` 5 参函数（024:33-50，旧 4 参已 drop 防重载歧义 024:30-31）。

### 3.14 user_daily_usage（2 行）
**PK (user_id, day, kind)** / count default 0。**kind check (generate_route, generate_route_month, ai_extract)**（020:31 原两值，025:19-21 扩）。day 列复用为「周期键」：按天桶存 YYYY-MM-DD，按月桶存当月 1 号（025:24-25 注释）。读写仅经 `get_user_daily_usage` / `bump_user_daily_usage`（020:49-100，均 revoke anon/authenticated、仅 service_role execute），代码侧经 `Project/lib/member-quota.ts:170/:192` rpc 调用。

## 4. 数据库函数与触发器汇总

| 对象 | 类型 | 迁移 | 作用 |
|---|---|---|---|
| is_admin() | function（security definer，空 search_path） | 009:6-19 | RLS 管理员判定，绕 users 表自引用 |
| handle_new_user() + on_auth_user_created | 触发器 | 010:5-22 | auth.users 插入 → 同步 public.users |
| prevent_role_change() + users_prevent_role_change | BEFORE UPDATE 触发器 | 010:27-46 | 登录态非管理员改 role → 42501 |
| prevent_member_self_grant() + users_prevent_member_self_grant | 同上 | 014:9-31 → 021:95-113 | 登录态非管理员改 member/member_since/member_source/member_until/trial_multi_day_used → 42501 |
| sync_admin_member() + users_admin_default_member | BEFORE UPDATE 触发器 | 015:24-48 | admin 行会员字段强制补齐、不可取消 |
| bump_amap_usage(5 参) | function | 019:63-87 → 024:30-58 | 用量原子累加（仅 service_role） |
| bump_user_daily_usage / get_user_daily_usage | function | 020:49-100 | 配额计数原子累加/读取（仅 service_role） |

守卫共同口径 [已确认]：`auth.uid() is null`（service_role / SQL Editor 直连）一律放行——这是「服务端接口写会员字段」能工作的原因（014:4-6 注释）；实测普通用户改身份字段被 42501 拒绝（历史验证记录，`docs/known-issues.md` A 级附注）。

## 5. 迁移链（25 份）

001-007 建 7 张核心表 → 008 开 RLS+授权 → 009 策略 → 010 同步/防提权触发器 → 011 种子 92 城 → 012 收藏三列 → 013 出行设置/会员/枚举扩充（建 member_logs）→ 014 member 守卫 → 015 admin 默认会员 → 016 演示数据 → 017 修 demo route_places → 018 transport 扩 4 值 → 019 落库缓存+用量（建 amap_leg_cache/amap_usage）→ 020 配额计数（建 user_daily_usage）→ 021 付费订单+分享（建 member_orders/route_shares）→ 022 pay_channel → 023 geocode 缓存 → 024 key_slot 维度 → 025 按月配额桶。全部幂等（if not exists / or replace / drop constraint if exists）。[已确认]（25 份文件逐一读取）

## 6. 证据来源

- `Project/supabase/migrations/001…025`（25 份全文，行号见文中）
- Harness 直连只读实测：14 表清单与行数、RLS 匿名 0 行验证（`docs/known-issues.md` §0、`docs/open-questions.md` Q-101/Q-102）
- 服务端消费代码：`Project/lib/member-quota.ts:170/:192`（rpc 调用）、`Project/app/api/try/city-places/route.ts:47-90`（service_role 跨用户读）

## 7. 待确认事项

1. **迁移应用状态（Q-002）**：25 份迁移是否都已在目标 Supabase 应用（025 曾经 `/pg/query` 手工执行，其余未逐一核对）→ Harness 查 `schema_migrations`。
2. **routes.transport 最终列定义（Q-008）**：004 内联 check 与 018 drop-and-add 的关系已从迁移文本确认（以 018 为准 4 值），但库内实际约束未查 → Harness 只读核对。
3. **cities 92 vs `Project/config/cities.ts` 104 个 `name:`**：差异原因未查明（可能含别名/重复项），[未知]。
4. **member_orders.plan 的 year/forever**：枚举仍在 check 里（021:34），但收银台仅月卡（`Project/config/business.ts:145` MEMBER_PLANS）——历史订单兼容口径待阶段 5 产品确认。
5. **演示数据归属**：016 与 seed-demo 接口把示例地点挂在管理员账号名下（`Project/app/api/admin/seed-demo/route.ts:16-18`），places 1326 行中示例数据占比未统计（Harness 可按 user_id 分组只读查询）。
