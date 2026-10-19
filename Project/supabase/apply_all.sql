-- apply_all.sql
-- 由 supabase/migrations/001~022 依次拼接而成，用于在全新 Supabase 环境一次性导入建库。
-- 若库已按 001~011 建好，只需执行 apply_012_013.sql（增量升级包）+ 014_member_guard.sql + 015_admin_default_member.sql + 016_seed_demo_data.sql + 017_fix_demo_route_places.sql + 018_transport_modes.sql + 019_amap_cache_and_usage.sql + 020_member_quota.sql + 021_member_paid_and_share.sql + 022_member_order_pay_channel.sql。
-- 请勿单独修改本文件；改动请改 001~022 后重新生成。
-- 注意：016 是演示样例数据（成都 22 个地点 / 4 条路线 / 22 条路线站点），
--       会在演示账号（1035940028@qq.com）下写入数据，不需要演示数据的环境可跳过 016。
--       017 是 016 早期关联缺陷的重复站点清理脚本（幂等）。已执行修正版 016 的全新环境无需执行；
--       在 2026-10-18 修正前执行过 016 的库，请执行 017 清理脏数据。
--       018 把 routes.transport 的 check 约束由 walk / bike 扩为 walk / bike / transit / drive
--       （「市内交通」4 种方式，取值同 config/enums.ts TRANSPORT / NAV_MODE）。
--       019 新增 amap_leg_cache（距离 / 算路结果落库缓存）与 amap_usage（每日调用 / 失败统计）两张表，
--       以及 bump_amap_usage 原子累加函数（仅 service_role 可执行），用于高德配额降本与用量看板。
--       020 新增 users.trial_multi_day_used（免费用户永久 1 次多日试用额度）与 user_daily_usage
--       （每人每天每类动作计数）+ bump_user_daily_usage / get_user_daily_usage（仅 service_role 可执行），
--       用于阶段 2 会员分层的服务端限额判定。
--       021 阶段 3：member_source 允许 paid、新增 users.member_until（付费会员到期时间，null = 永久）、
--       新增 member_orders（收款码人工核销订单，仅 owner 可读）与 route_shares（长图 / 二维码分享令牌，仅 service_role）。
--       022 给 member_orders 新增 pay_channel（微信 / 支付宝收款码通道），供管理员核销时按通道对账。

-- 001_create_users.sql
-- users：用户表，id 与 auth.users 一一对应，注册时由 010 的触发器写入。

create table if not exists public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text unique,
  username      text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  last_seen_at  timestamptz,
  current_path  text,
  created_at    timestamptz not null default now()
);

comment on table  public.users               is '用户表，id 与 auth.users 同步，role 控制管理员权限';
comment on column public.users.role          is 'user / admin，取值见 config/enums.ts USER_ROLE（E10/E11）';
comment on column public.users.last_seen_at  is '最后活跃时间，由 /api/heartbeat 更新；在线判定阈值见 B04';
comment on column public.users.current_path  is '当前所在页面，由 /api/heartbeat 更新';

-- 002_create_cities.sql
-- cities：城市字典，所有人可读；数据由 011_seed_cities.sql 初始化。

create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  adcode      text not null,
  created_at  timestamptz not null default now()
);

-- 城市名唯一：便于按名称查询，且让初始化脚本可重复执行（on conflict (name)）
create unique index if not exists cities_name_key on public.cities (name);
-- 高德城市编码不应重复
create unique index if not exists cities_adcode_key on public.cities (adcode);

comment on table  public.cities        is '城市字典（CT01-CT03），name 与 config/cities.ts 保持一致（SY07）';
comment on column public.cities.adcode is '高德城市编码（adcode），如 厦门=350200';

-- 003_create_places.sql
-- places：用户地点库（景点 / 美食），来源见 imports.source。

create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  city_id     uuid references public.cities (id) on delete set null,
  name        text not null,
  address     text,
  type        text not null check (type in ('attraction', 'food')),
  note        text,
  image_url   text,
  open_hours  text,
  rating      numeric(2, 1) check (rating >= 0),
  lat         numeric(10, 6) check (lat >= -90 and lat <= 90),
  lng         numeric(10, 6) check (lng >= -180 and lng <= 180),
  source_url  text,
  created_at  timestamptz not null default now()
);

create index if not exists places_user_id_idx on public.places (user_id);
create index if not exists places_city_id_idx on public.places (city_id);

comment on table  public.places      is '用户地点库，坐标由高德搜索写入';
comment on column public.places.type is 'attraction=景点 / food=美食（存枚举值，展示时用 *_LABEL 映射）';

-- 004_create_routes.sql
-- routes：用户生成的旅行路线。

create table if not exists public.routes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  city_id     uuid references public.cities (id) on delete set null,
  title       text not null,
  days        int not null check (days >= 1),
  transport   text not null check (transport in ('walk', 'bike', 'transit', 'drive')),
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists routes_user_id_idx on public.routes (user_id);
create index if not exists routes_city_id_idx on public.routes (city_id);

comment on table  public.routes           is '用户路线，is_public 对应 B11 公开路线（第一版关闭）';
comment on column public.routes.days      is '天数，上限 MAX_DAYS(B02) 由应用层校验，此处只约束 >=1';
comment on column public.routes.transport is 'walk / bike / transit / drive，取值见 config/enums.ts TRANSPORT（E03/E04）';

-- 005_create_route_places.sql
-- route_places：路线与地点的关联（第几天、第几站）。
-- day_index / order_index 均为 0 基，与前端数组下标一致。

create table if not exists public.route_places (
  id           uuid primary key default gen_random_uuid(),
  route_id     uuid not null references public.routes (id) on delete cascade,
  place_id     uuid not null references public.places (id) on delete cascade,
  day_index    int not null check (day_index >= 0),
  order_index  int not null check (order_index >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists route_places_route_id_idx
  on public.route_places (route_id, day_index, order_index);
create index if not exists route_places_place_id_idx on public.route_places (place_id);

comment on table  public.route_places             is '路线-地点关联，一天最多 MAX_PLACES_PER_DAY(B01) 个点由应用层校验';
comment on column public.route_places.day_index   is '第几天，0 基（前端数组下标）';
comment on column public.route_places.order_index is '当天第几站，0 基（前端数组下标）';

-- 006_create_imports.sql
-- imports：文案导入记录（小红书 / 抖音 / 手动）。

create table if not exists public.imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  raw_text    text not null,
  source      text not null check (source in ('xiaohongshu', 'douyin', 'manual')),
  status      text not null check (status in ('success', 'failed')),
  created_at  timestamptz not null default now()
);

create index if not exists imports_user_id_idx on public.imports (user_id);

comment on table  public.imports        is '文案导入记录，供管理员页 /admin/imports 查询';
comment on column public.imports.source is 'xiaohongshu / douyin / manual，见 config/enums.ts IMPORT_SOURCE（E05-E07）';
comment on column public.imports.status is 'success / failed，见 config/enums.ts IMPORT_STATUS（E08/E09）';

-- 007_create_events.sql
-- events：埋点事件，前端直接插入 Supabase。

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  event_name  text not null check (event_name in ('add_place', 'generate_route', 'click_upgrade')),
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_name_created_at_idx on public.events (event_name, created_at desc);

comment on table  public.events            is '埋点事件，见 技术方案 v1.1 §4.9';
comment on column public.events.event_name is 'add_place / generate_route / click_upgrade，见 config/enums.ts EVENT_NAME（E12-E14）';

-- 008_enable_rls.sql
-- 为全部表开启 RLS（策略见 009_rls_policies.sql）。

alter table public.users        enable row level security;
alter table public.cities       enable row level security;
alter table public.places       enable row level security;
alter table public.routes       enable row level security;
alter table public.route_places enable row level security;
alter table public.imports      enable row level security;
alter table public.events       enable row level security;

-- 授权：本项目已开启 Supabase「自动暴露新表」，此处显式补上，换环境时同样可用。
-- 只授 DML，实际能读写哪些行由 009 的 RLS 策略决定。
grant usage on schema public to anon, authenticated;

-- cities 是字典表，未登录用户也要能读（ALLOW_GUEST_TRIAL=true，见 B08）
grant select on public.cities to anon, authenticated;

grant select, insert, update, delete on public.users        to authenticated;
grant select, insert, update, delete on public.places       to authenticated;
grant select, insert, update, delete on public.routes       to authenticated;
grant select, insert, update, delete on public.route_places to authenticated;
grant select, insert, update, delete on public.imports      to authenticated;
grant select, insert, update, delete on public.events       to authenticated;

-- 009_rls_policies.sql
-- RLS 策略：按「归属」判断，管理员用 is_admin() 放行（技术方案 v1.1 §4.8）。

-- 判断当前登录用户是否管理员。
-- security definer + 空 search_path：绕过 users 表的 RLS，避免策略自引用递归，同时防 search_path 注入。
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

comment on function public.is_admin() is 'RLS 辅助函数：当前登录用户是否 role=admin';

-- ============================ users ============================
drop policy if exists users_select_self  on public.users;
drop policy if exists users_select_admin on public.users;
drop policy if exists users_update_self  on public.users;

create policy users_select_self on public.users
  for select to authenticated
  using (auth.uid() = id);

create policy users_select_admin on public.users
  for select to authenticated
  using (public.is_admin());

create policy users_update_self on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================ cities ============================
drop policy if exists cities_select_all on public.cities;

create policy cities_select_all on public.cities
  for select to anon, authenticated
  using (true);

-- ============================ places ============================
drop policy if exists places_select_own   on public.places;
drop policy if exists places_select_admin on public.places;
drop policy if exists places_insert_own   on public.places;
drop policy if exists places_update_own   on public.places;
drop policy if exists places_delete_own   on public.places;

create policy places_select_own on public.places
  for select to authenticated
  using (auth.uid() = user_id);

create policy places_select_admin on public.places
  for select to authenticated
  using (public.is_admin());

create policy places_insert_own on public.places
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy places_update_own on public.places
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy places_delete_own on public.places
  for delete to authenticated
  using (auth.uid() = user_id);

-- ============================ routes ============================
drop policy if exists routes_select_own   on public.routes;
drop policy if exists routes_select_admin on public.routes;
drop policy if exists routes_insert_own   on public.routes;
drop policy if exists routes_update_own   on public.routes;
drop policy if exists routes_delete_own   on public.routes;

create policy routes_select_own on public.routes
  for select to authenticated
  using (auth.uid() = user_id);

create policy routes_select_admin on public.routes
  for select to authenticated
  using (public.is_admin());

create policy routes_insert_own on public.routes
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy routes_update_own on public.routes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy routes_delete_own on public.routes
  for delete to authenticated
  using (auth.uid() = user_id);

-- ======================= route_places =========================
-- 通过所属路线（routes.user_id）判断归属
drop policy if exists route_places_select_own   on public.route_places;
drop policy if exists route_places_select_admin on public.route_places;
drop policy if exists route_places_insert_own   on public.route_places;
drop policy if exists route_places_update_own   on public.route_places;
drop policy if exists route_places_delete_own   on public.route_places;

create policy route_places_select_own on public.route_places
  for select to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.user_id = auth.uid()
    )
  );

create policy route_places_select_admin on public.route_places
  for select to authenticated
  using (public.is_admin());

create policy route_places_insert_own on public.route_places
  for insert to authenticated
  with check (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.user_id = auth.uid()
    )
  );

create policy route_places_update_own on public.route_places
  for update to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.user_id = auth.uid()
    )
  );

create policy route_places_delete_own on public.route_places
  for delete to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.user_id = auth.uid()
    )
  );

-- ============================ imports ============================
drop policy if exists imports_select_own   on public.imports;
drop policy if exists imports_select_admin on public.imports;
drop policy if exists imports_insert_own   on public.imports;
drop policy if exists imports_update_own   on public.imports;
drop policy if exists imports_delete_own   on public.imports;

create policy imports_select_own on public.imports
  for select to authenticated
  using (auth.uid() = user_id);

create policy imports_select_admin on public.imports
  for select to authenticated
  using (public.is_admin());

create policy imports_insert_own on public.imports
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy imports_update_own on public.imports
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy imports_delete_own on public.imports
  for delete to authenticated
  using (auth.uid() = user_id);

-- ============================ events ============================
-- 按要求：用户只能 insert 自己的；管理员可 select 全部。
drop policy if exists events_insert_own   on public.events;
drop policy if exists events_select_admin on public.events;

create policy events_insert_own on public.events
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy events_select_admin on public.events
  for select to authenticated
  using (public.is_admin());

-- 010_triggers.sql
-- 触发器：1) 注册时同步 auth.users -> public.users；2) 阻止普通用户改自己的 role 提权。

-- 1) 新用户注册时创建 users 行，email 取自 auth.users，role 默认 user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) 防提权：users_update_self 策略允许用户改自己那一行，必须挡住把 role 改成 admin。
--    直接用 SQL / service_role 操作时 auth.uid() 为 null，放行（用于 C07 设管理员）；
--    走登录态时，只有管理员能改 role。
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'FORBIDDEN: 只有管理员可以修改 role' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_role_change on public.users;
create trigger users_prevent_role_change
  before update on public.users
  for each row execute function public.prevent_role_change();

-- 011_seed_cities.sql
-- 城市初始化数据（CT01-CT03：内置数据，至少 50 个）。
-- adcode 采用高德城市编码；直辖市取 110000 / 120000 / 310000 / 500000。
-- 本表数据需与 config/cities.ts 保持一致（SY07），后续新增城市请同时改两处。

insert into public.cities (name, adcode) values
  -- 直辖市
  ('北京', '110000'),
  ('上海', '310000'),
  ('天津', '120000'),
  ('重庆', '500000'),
  -- 广东
  ('广州', '440100'),
  ('深圳', '440300'),
  ('珠海', '440400'),
  ('汕头', '440500'),
  ('佛山', '440600'),
  ('惠州', '441300'),
  ('东莞', '441900'),
  ('中山', '442000'),
  -- 浙江
  ('杭州', '330100'),
  ('宁波', '330200'),
  ('温州', '330300'),
  ('嘉兴', '330400'),
  ('绍兴', '330600'),
  ('金华', '330700'),
  ('舟山', '330900'),
  ('台州', '331000'),
  -- 江苏
  ('南京', '320100'),
  ('无锡', '320200'),
  ('徐州', '320300'),
  ('常州', '320400'),
  ('苏州', '320500'),
  ('南通', '320600'),
  ('扬州', '321000'),
  -- 四川
  ('成都', '510100'),
  ('绵阳', '510700'),
  ('乐山', '511100'),
  ('宜宾', '511500'),
  -- 陕西
  ('西安', '610100'),
  ('宝鸡', '610300'),
  ('咸阳', '610400'),
  -- 福建
  ('厦门', '350200'),
  ('福州', '350100'),
  ('泉州', '350500'),
  ('漳州', '350600'),
  -- 湖北
  ('武汉', '420100'),
  ('宜昌', '420500'),
  ('襄阳', '420600'),
  ('荆州', '421000'),
  -- 湖南
  ('长沙', '430100'),
  ('岳阳', '430600'),
  ('张家界', '430800'),
  -- 河南
  ('郑州', '410100'),
  ('开封', '410200'),
  ('洛阳', '410300'),
  -- 山东
  ('济南', '370100'),
  ('青岛', '370200'),
  ('烟台', '370600'),
  ('潍坊', '370700'),
  ('泰安', '370900'),
  ('威海', '371000'),
  -- 辽宁 / 黑龙江 / 吉林
  ('沈阳', '210100'),
  ('大连', '210200'),
  ('哈尔滨', '230100'),
  ('长春', '220100'),
  ('吉林', '220200'),
  -- 河北
  ('石家庄', '130100'),
  ('秦皇岛', '130300'),
  ('保定', '130600'),
  ('承德', '130800'),
  -- 山西
  ('太原', '140100'),
  ('大同', '140200'),
  -- 安徽
  ('合肥', '340100'),
  ('芜湖', '340200'),
  ('黄山', '341000'),
  -- 江西
  ('南昌', '360100'),
  ('景德镇', '360200'),
  ('九江', '360400'),
  ('赣州', '360700'),
  -- 广西
  ('南宁', '450100'),
  ('桂林', '450300'),
  ('北海', '450500'),
  -- 海南
  ('海口', '460100'),
  ('三亚', '460200'),
  -- 贵州
  ('贵阳', '520100'),
  ('遵义', '520300'),
  -- 云南
  ('昆明', '530100'),
  ('丽江', '530700'),
  ('大理', '532900'),
  ('西双版纳', '532800'),
  -- 西藏 / 甘肃 / 青海 / 宁夏
  ('拉萨', '540100'),
  ('兰州', '620100'),
  ('酒泉', '620900'),
  ('西宁', '630100'),
  ('银川', '640100'),
  -- 内蒙古 / 新疆
  ('呼和浩特', '150100'),
  ('鄂尔多斯', '150600'),
  ('呼伦贝尔', '150700'),
  ('乌鲁木齐', '650100')
on conflict (name) do nothing;

-- 012_places_collection.sql
-- U11 收藏地点：places 增加「收藏标记 / 来源 / 坐标匹配」三列。
--
-- 设计说明（已与产品确认，不新建独立收藏表）：
--   places 本身就是「按用户隔离的私人地点库」（user_id 非空 + RLS auth.uid() = user_id），
--   收藏语义 = 该行存在；「出行时从收藏同步」= 从 places 挑点写进 route_places（只引用 place_id）。
--   因此加入路线不会改动 places，收藏与路线天然解耦。
--   唯一需要的是「从收藏移除、但路线里仍要保留这个点」：
--   route_places.place_id 是 on delete cascade，直接删 places 行会连带删掉路线上的站点，
--   所以用软标记 is_collected = false 表达「已从收藏移除」，收藏页只查 is_collected = true。

alter table public.places
  add column if not exists is_collected boolean not null default true,
  add column if not exists source       text,
  add column if not exists geo_status   text not null default 'matched';

-- 来源枚举与 imports.source 保持一致（config/enums.ts IMPORT_SOURCE，E05-E07）
alter table public.places drop constraint if exists places_source_check;
alter table public.places
  add constraint places_source_check
  check (source is null or source in ('xiaohongshu', 'douyin', 'manual'));

-- 坐标匹配状态，供管理端 A05 地点列表展示（已匹配 / 待确认 / 未匹配）
alter table public.places drop constraint if exists places_geo_status_check;
alter table public.places
  add constraint places_geo_status_check
  check (geo_status in ('matched', 'pending', 'unmatched'));

-- 收藏页按「本人的未移除收藏」过滤，走联合索引
create index if not exists places_user_collected_idx
  on public.places (user_id, is_collected);

comment on column public.places.is_collected is '是否在「我的收藏」中；false = 已从收藏移除（保留行以支撑 route_places 引用）';
comment on column public.places.source       is '地点来源：xiaohongshu / douyin / manual，见 config/enums.ts IMPORT_SOURCE（E05-E07）';
comment on column public.places.geo_status   is '坐标匹配状态：matched / pending / unmatched，供 A05 地点列表展示';

-- 013_p0_modules.sql
-- 三个「超出 PRD P0」模块 + 两处枚举扩充的库结构改动。
--   ① 出行设置（U05 / U08 / A06）：routes 加 6 列
--   ② 会员体系（U10 / A02 / A03）：users 加会员字段 + member_logs 留痕表
--   ③ 导入状态四态（A07）：imports.status 枚举扩充
--   ④ 埋点事件扩充：events.event_name 枚举扩充
-- 全部语句幂等，可重复执行。

-- ==================== ① 出行设置（U05 / U08 / A06） ====================
alter table public.routes
  add column if not exists origin_city     text,
  add column if not exists intercity_mode  text,
  add column if not exists lodging_type    text,
  add column if not exists lodging_name    text,
  add column if not exists lodging_area    text,
  add column if not exists lodging_nights  int;

alter table public.routes drop constraint if exists routes_intercity_mode_check;
alter table public.routes
  add constraint routes_intercity_mode_check
  check (intercity_mode is null or intercity_mode in ('hsr', 'plane', 'drive', 'coach', 'sleeper', 'none'));

alter table public.routes drop constraint if exists routes_lodging_type_check;
alter table public.routes
  add constraint routes_lodging_type_check
  check (lodging_type is null or lodging_type in ('hotel', 'homestay', 'hostel', 'relative', 'other'));

alter table public.routes drop constraint if exists routes_lodging_nights_check;
alter table public.routes
  add constraint routes_lodging_nights_check
  check (lodging_nights is null or (lodging_nights >= 1 and lodging_nights <= 30));

comment on column public.routes.origin_city    is '出发城市；空 = 未填写（U05 / U08 / A06）';
comment on column public.routes.intercity_mode is '城际交通·去程：hsr/plane/drive/coach/sleeper/none，见 config/enums.ts INTERCITY_MODE';
comment on column public.routes.lodging_type   is '住宿类型：hotel/homestay/hostel/relative/other，见 config/enums.ts LODGING_TYPE';
comment on column public.routes.lodging_name   is '住宿名称（酒店名 / 民宿名），可空';
comment on column public.routes.lodging_area   is '住宿所在区域（如「宽窄巷子附近」），可空';
comment on column public.routes.lodging_nights is '入住晚数，1-30；空 = 暂不预订';

-- ==================== ② 会员体系（U10 / A02 / A03） ====================
alter table public.users
  add column if not exists member         boolean not null default false,
  add column if not exists member_since   timestamptz,
  add column if not exists member_source  text;

alter table public.users drop constraint if exists users_member_source_check;
alter table public.users
  add constraint users_member_source_check
  check (member_source is null or member_source in ('self', 'admin'));

comment on column public.users.member        is '是否会员；第一版为模拟开通（未接入真实支付）';
comment on column public.users.member_since  is '会员开通时间';
comment on column public.users.member_source is '开通来源：self=用户自助升级 / admin=管理员开通，见 config/enums.ts MEMBER_SOURCE';

create index if not exists users_member_idx on public.users (member) where member;

-- 会员操作留痕（A03「会员操作留痕卡」）
create table if not exists public.member_logs (
  id          uuid primary key default gen_random_uuid(),
  target_user uuid not null references public.users (id) on delete cascade,
  action      text not null check (action in ('grant', 'revoke')),
  operator_id uuid references public.users (id) on delete set null,
  source      text not null check (source in ('self', 'admin')),
  created_at  timestamptz not null default now()
);

create index if not exists member_logs_target_idx
  on public.member_logs (target_user, created_at desc);
create index if not exists member_logs_created_idx
  on public.member_logs (created_at desc);

alter table public.member_logs enable row level security;
grant select on public.member_logs to authenticated;

-- 写入统一走服务端（/api/admin/member 用 Secret Key），service_role 绕过 RLS，故此处不开放 insert 策略。
drop policy if exists member_logs_select_admin on public.member_logs;
create policy member_logs_select_admin on public.member_logs
  for select to authenticated
  using (public.is_admin());

comment on table  public.member_logs             is '会员开通/取消留痕，管理端 A03 展示；写入由服务端接口完成';
comment on column public.member_logs.action      is 'grant=开通 / revoke=取消';
comment on column public.member_logs.operator_id is '操作人（自助升级时 = 本人；管理员开通时 = 管理员）';

-- ==================== ③ 导入状态四态（A07） ====================
-- 原为 success / failed 两态，A07 需要：提取成功 / 需补文案 / 未识别 / 失败
alter table public.imports drop constraint if exists imports_status_check;
alter table public.imports
  add constraint imports_status_check
  check (status in ('success', 'need_text', 'unrecognized', 'failed'));

comment on column public.imports.status is 'success=提取成功 / need_text=需补文案 / unrecognized=未识别 / failed=失败，见 config/enums.ts IMPORT_STATUS';

-- ==================== ④ 埋点事件扩充 ====================
-- 原为 add_place / generate_route / click_upgrade，按原型新增 4 个
alter table public.events drop constraint if exists events_event_name_check;
alter table public.events
  add constraint events_event_name_check
  check (event_name in (
    'add_place', 'generate_route', 'click_upgrade',
    'sign_up', 'collect_add_route', 'collect_remove', 'member_change'
  ));

comment on column public.events.event_name is 'add_place / generate_route / click_upgrade / sign_up / collect_add_route / collect_remove / member_change，见 config/enums.ts EVENT_NAME';



-- ==================== 014 会员字段防提权触发器 ====================
-- 014_member_guard.sql
-- 防提权：users_update_self 策略允许用户改自己那一行，必须挡住把 member 三列自己改成会员。
-- 与 010_triggers.sql 的 prevent_role_change 保持同一套判断方式：
--   1) auth.uid() is null（service_role / SQL Editor 直连）→ 放行，
--      因此 /api/member（用户自助升级）与 /api/admin/member（管理员操作）走服务端 Secret Key 不受影响；
--   2) 走登录态时，只有 public.is_admin() 为真才允许改，普通用户改这三列会被拦下（42501）。
-- 幂等：可重复执行。

create or replace function public.prevent_member_self_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.member is distinct from old.member
      or new.member_since is distinct from old.member_since
      or new.member_source is distinct from old.member_source)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'FORBIDDEN: 只有管理员可以修改会员字段' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.prevent_member_self_grant() is '禁止普通用户自行修改用户身份（member / member_since / member_source），只允许管理员或服务端修改，见 014_member_guard.sql';

drop trigger if exists users_prevent_member_self_grant on public.users;
create trigger users_prevent_member_self_grant
  before update on public.users
  for each row execute function public.prevent_member_self_grant();

-- ==================== 015 管理员默认最高级会员 ====================
-- 015_admin_default_member.sql
-- 管理员账号默认享有最高级会员：会员权益由「账号角色」自动决定，不需手工开通。
-- 回填现有 admin 行 + 建 users_admin_default_member 触发器（BEFORE UPDATE，强制 admin 行
-- 的 member 三列）；与 014 同为 BEFORE UPDATE，按触发器名先后执行（admin_default 先于
-- prevent_member_self_grant），015 只做补齐、不拦截，故不冲突。
-- 幂等：可重复执行。

update public.users
   set member        = true,
       member_since  = coalesce(member_since, now()),
       member_source = 'admin'
 where role = 'admin'
   and (member is not true or member_source is null);

create or replace function public.sync_admin_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'admin' then
    new.member        := true;
    new.member_since  := coalesce(new.member_since, old.member_since, now());
    new.member_source := 'admin';
  end if;
  return new;
end;
$$;

comment on function public.sync_admin_member() is
  'BEFORE UPDATE 触发器函数：把 admin 行的会员字段强制补齐为最高级会员';

drop trigger if exists users_admin_default_member on public.users;
create trigger users_admin_default_member
  before update on public.users
  for each row
  execute function public.sync_admin_member();

-- 016_seed_demo_data.sql
-- 用途：为演示账号补一份可现场演示的「成都」样例数据，让 U09 路线结果 / U03 我的路线 /
--      U11 我的收藏 三个页面立刻有内容可看。数据全部取自墨刀高保真原型
--      （u02-home / u03-my-routes / u06-add / u07-places / u11-collected / a06-admin-routes）里的成都示例。
--
-- 落库内容：
--   ① 22 个成都地点（全部 is_collected = true，即「我的收藏」里能看到 22 条）
--   ② 4 条成都示例路线（含出发城市 / 城际交通 / 住宿等出行设置）
--   ③ 22 条 route_places（4 条路线的按天顺序，与原型顺序一致）
--
-- 执行方式：**手动**。本机没有 psql / supabase CLI / Docker，无法命令行执行，
--          请在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。
--
-- 前置条件：002/003/004/005/011/012/013 迁移已执行；演示账号已注册（public.users 内存在该 email）。
-- 目标账号：由下面的 admin_user CTE 按 email 反查，绝不写死 uuid。
-- 幂等性：所有 insert 都带「同名（同路线同地点）」存在性判断，可重复执行且不会产生重复数据。
--          重复执行时「成都」城市 insert 是 on conflict do nothing，等于空操作。
--
-- 说明：地点坐标（lat / lng）保持为空、geo_status = 'pending'，
--      因为原型示例给的是示意画布坐标，不是真实经纬度；U09 结果页在缺坐标时只渲染示意底图，
--      不画站点连线与站间距离，等用户用高德搜索补齐真实坐标后会自动出现。

-- ============ 0) 城市兜底（成都已在 011_seed_cities.sql 中，这里只兜底） ============
insert into public.cities (name, adcode)
values ('成都', '510100')
on conflict (name) do nothing;

-- ============ 1) 22 个成都地点（收藏） ============
with admin_user as (
  select id from public.users where email = '1035940028@qq.com' limit 1
),
cd as (
  select id from public.cities where name = '成都' limit 1
)
insert into public.places (user_id, city_id, name, address, type, note, source, is_collected, geo_status)
select au.id, cd.id, d.name, d.address, d.type, d.note, d.source, true, 'pending'
from (
  values
    ('宽窄巷子',         '青羊区', 'attraction', '青砖巷子适合拍照，早上人少',          'xiaohongshu'),
    ('人民公园',         '青羊区', 'attraction', '鹤鸣茶社喝盖碗茶，体验采耳',            'xiaohongshu'),
    ('天府广场',         '青羊区', 'attraction', null,                                    null),
    ('春熙路',           '锦江区', 'attraction', null,                                    null),
    ('太古里',           '锦江区', 'attraction', null,                                    null),
    ('武侯祠',           '武侯区', 'attraction', '三国文化打卡，隔壁就是锦里',            'douyin'),
    ('锦里古街',         '武侯区', 'attraction', '夜景好看，小吃偏贵可略过',              'douyin'),
    ('杜甫草堂',         '青羊区', 'attraction', null,                                    null),
    ('九眼桥',           '锦江区', 'attraction', null,                                    null),
    ('东郊记忆',         '成华区', 'attraction', null,                                    null),
    ('文殊院',           '青羊区', 'attraction', null,                                    null),
    ('成都大熊猫基地',   '成华区', 'attraction', null,                                    null),
    ('鹤鸣茶社',         '青羊区', 'food',       null,                                    null),
    ('陈麻婆豆腐',       '青羊区', 'food',       '招牌麻婆豆腐，人均 50 左右',            'xiaohongshu'),
    ('钟水饺',           '锦江区', 'food',       '甜辣口红油饺子，小份刚好',              'xiaohongshu'),
    ('龙抄手',           '锦江区', 'food',       null,                                    null),
    ('贺记蛋烘糕',       '武侯区', 'food',       '路边摊小吃，排队约 10 分钟',            'manual'),
    ('蜀九香火锅',       '锦江区', 'food',       '本地人常去的牛油火锅，记得提前取号',    'douyin'),
    ('王妈手撕烤兔',     '武侯区', 'food',       null,                                    null),
    ('冒椒火辣',         '锦江区', 'food',       null,                                    null),
    ('洞子口张老二凉粉', '金牛区', 'food',       null,                                    null),
    ('马旺子川菜',       '锦江区', 'food',       null,                                    null)
) as d(name, address, type, note, source)
cross join admin_user au
cross join cd
where not exists (
  select 1
  from public.places p
  where p.user_id = au.id
    and p.name = d.name
    and p.city_id is not distinct from cd.id
);

-- ============ 2) 4 条成都示例路线 ============
with admin_user as (
  select id from public.users where email = '1035940028@qq.com' limit 1
),
cd as (
  select id from public.cities where name = '成都' limit 1
)
insert into public.routes (
  user_id, city_id, title, days, transport,
  origin_city, intercity_mode, lodging_type, lodging_area, lodging_name, lodging_nights
)
select au.id, cd.id, d.title, d.days, d.transport,
       d.origin_city, d.intercity_mode, d.lodging_type, d.lodging_area, d.lodging_name, d.lodging_nights
from (
  values
    ('成都 · 吃喝一条线',       2, 'walk', '重庆', 'hsr',   'homestay', '宽窄巷子附近', null, 1),
    ('成都 · 老城区半日骑行',   1, 'bike', '成都', null,    null,       null,           null, null),
    ('周末带娃逛成都',          1, 'bike', '德阳', 'drive', 'relative', null,           null, 1),
    ('成都慢生活',              1, 'walk', '绵阳', null,    null,       null,           null, null)
) as d(title, days, transport, origin_city, intercity_mode, lodging_type, lodging_area, lodging_name, lodging_nights)
cross join admin_user au
cross join cd
where not exists (
  select 1
  from public.routes r
  where r.user_id = au.id
    and r.title = d.title
);

-- ============ 3) 22 条 route_places（按天顺序，与原型一致） ============
with admin_user as (
  select id from public.users where email = '1035940028@qq.com' limit 1
),
cd as (
  select id from public.cities where name = '成都' limit 1
)
insert into public.route_places (route_id, place_id, day_index, order_index)
select r.id, p.id, d.day_index, d.order_index
from (
  values
    -- R1 成都 · 吃喝一条线（2 天）
    ('成都 · 吃喝一条线', 0, 0, '陈麻婆豆腐'),
    ('成都 · 吃喝一条线', 0, 1, '宽窄巷子'),
    ('成都 · 吃喝一条线', 0, 2, '人民公园'),
    ('成都 · 吃喝一条线', 0, 3, '钟水饺'),
    ('成都 · 吃喝一条线', 0, 4, '春熙路'),
    ('成都 · 吃喝一条线', 0, 5, '太古里'),
    ('成都 · 吃喝一条线', 1, 0, '武侯祠'),
    ('成都 · 吃喝一条线', 1, 1, '锦里古街'),
    ('成都 · 吃喝一条线', 1, 2, '贺记蛋烘糕'),
    ('成都 · 吃喝一条线', 1, 3, '九眼桥'),
    ('成都 · 吃喝一条线', 1, 4, '蜀九香火锅'),
    -- R2 成都 · 老城区半日骑行（1 天）
    ('成都 · 老城区半日骑行', 0, 0, '文殊院'),
    ('成都 · 老城区半日骑行', 0, 1, '洞子口张老二凉粉'),
    ('成都 · 老城区半日骑行', 0, 2, '宽窄巷子'),
    ('成都 · 老城区半日骑行', 0, 3, '人民公园'),
    -- R3 周末带娃逛成都（1 天）
    ('周末带娃逛成都', 0, 0, '成都大熊猫基地'),
    ('周末带娃逛成都', 0, 1, '东郊记忆'),
    ('周末带娃逛成都', 0, 2, '钟水饺'),
    ('周末带娃逛成都', 0, 3, '太古里'),
    -- R4 成都慢生活（1 天）
    ('成都慢生活', 0, 0, '人民公园'),
    ('成都慢生活', 0, 1, '鹤鸣茶社'),
    ('成都慢生活', 0, 2, '宽窄巷子')
) as d(route_title, day_index, order_index, place_name)
join admin_user au on true
join cd on true
join public.routes r
  on r.user_id = au.id
 and r.title = d.route_title
-- 必须同时限定城市：同名地点可能在该账号下存在多条（例如 city_id 为空的历史数据），
-- 只按 name 关联会配上多条、导致同一站点出现重复行。
join public.places p
  on p.user_id = au.id
 and p.name = d.place_name
 and p.city_id = cd.id
where not exists (
  select 1
  from public.route_places rp
  where rp.route_id = r.id
    and rp.place_id = p.id
);

-- ============ 4) 执行后自检（可按需单跑） ============
-- 期望：地点 22 条、路线 4 条、路线站点 22 条。
--   select count(*) from public.places
--    where user_id = (select id from public.users where email = '1035940028@qq.com')
--      and city_id = (select id from public.cities where name = '成都')
--      and is_collected;
--   select count(*) from public.routes
--    where user_id = (select id from public.users where email = '1035940028@qq.com');
--   select count(*) from public.route_places rp
--     join public.routes r on r.id = rp.route_id
--    where r.user_id = (select id from public.users where email = '1035940028@qq.com');

-- 017_fix_demo_route_places.sql
-- 用途：清理 016 因关联缺陷产生的重复站点。
--
-- 背景：016 的 route_places 关联最初只按 places.name 匹配、未限定城市。
--       若同一账号下存在「同名但 city_id 为空」的历史地点（早期手动测试留下的 16 条），
--       同一条示例站点会被配出两行：place_id 不同，而 name / 天 / 序完全相同。
--       结果 4 条示例路线的站点共 40 行（应为 22 行），界面上会出现重复站点。
--       016 的关联条件已同步修正（补上 p.city_id = cd.id），本文件只负责删掉已产生的脏数据。
--
-- 修复范围：仅「4 条成都示例路线」中、指向「该账号下 city_id 为空的历史地点」的 route_places 行。
--           不动用户自己建的其他路线，也不删那些历史地点本身（可去管理端地点列表按需清理）。
-- 幂等性：可重复执行，第二次已无行可删。

delete from public.route_places rp
where rp.place_id in (
    select p.id
    from public.places p
    join public.users u on u.id = p.user_id
    where u.email = '1035940028@qq.com'
      and p.city_id is null
  )
  and rp.route_id in (
    select r.id
    from public.routes r
    join public.users u on u.id = r.user_id
    where u.email = '1035940028@qq.com'
      and r.title in (
        '成都 · 吃喝一条线',
        '成都 · 老城区半日骑行',
        '周末带娃逛成都',
        '成都慢生活'
      )
  );

-- 018_transport_modes.sql
-- 用途：把 routes.transport 的取值从 walk / bike 扩为 walk / bike / transit / drive（「市内交通」4 种方式）。
--
-- 背景：U05 新建路线 / U07 勾选地点 / U08 调整路线的「市内交通」由 2 种方式扩为 4 种
--       （步行 / 骑行 / 公交地铁 / 驾车），取值与结果页 U09 的 NAV_MODE 完全一致。
--       原 check 约束（004_create_routes.sql 内联）只允许 walk / bike，
--       不改会导致选择「公交地铁 / 驾车」创建路线时被库拒绝。
-- 幂等性：可重复执行（drop if exists → add）。

alter table public.routes drop constraint if exists routes_transport_check;
alter table public.routes
  add constraint routes_transport_check
  check (transport in ('walk', 'bike', 'transit', 'drive'));

comment on column public.routes.transport is 'walk / bike / transit / drive，取值见 config/enums.ts TRANSPORT（E03/E04）';

-- 019_amap_cache_and_usage.sql
-- 用途：高德配额降本 + 用量统计（阶段：降本 + 用量看板）。
--
-- 背景：本账号为高德个人认证开发者，基础 LBS 服务配额 15 万次/月（硬顶）。
--       原来 lib/amap.ts 的距离 / 算路结果只做了「进程内 10 分钟缓存」，多进程 / 多用户不共享，
--       同一对地点会被反复请求。本迁移把结果落库缓存，并新增每日用量表供看板与熔断降级使用。
--   ① public.amap_leg_cache —— 距离 / 算路结果落库缓存（跨进程 / 跨用户共享，TTL 见 config/business.ts）。
--   ② public.amap_usage     —— 每日各高德服务的调用次数 / 失败次数。
--   ③ public.bump_amap_usage—— 原子累加函数（PostgREST 无法直接原子自增，必须走 SQL 函数）。
--
-- 幂等性：可重复执行（create ... if not exists / create or replace）。

-- ==================== ① 距离 / 算路结果落库缓存 ====================
create table if not exists public.amap_leg_cache (
  mode             text        not null,
  from_lnglat      text        not null,
  to_lnglat        text        not null,
  distance_meters  integer     not null,
  duration_seconds integer     not null,
  updated_at       timestamptz not null default now(),
  primary key (mode, from_lnglat, to_lnglat)
);

comment on table public.amap_leg_cache is
  '高德距离 / 算路结果落库缓存；同一对地点只存一行（from / to 按字符串排序后写入），TTL 见 config/business.ts AMAP_CACHE_TTL_DAYS，超过视为未命中并重新请求覆盖';
comment on column public.amap_leg_cache.mode is
  '缓存键：距离矩阵用 dist:<navmode>（如 dist:walk），算路用 <navmode>[:<cityAdcode>]（如 walk / drive / transit:510100），两者不共用 key';
comment on column public.amap_leg_cache.from_lnglat is
  '''lng,lat'' 字符串；写入前与 to_lnglat 按字符串排序，from 存较小者，一对地点天然只占一行';
comment on column public.amap_leg_cache.to_lnglat is
  '''lng,lat'' 字符串；与 from_lnglat 成对，排序后 from 存较小者';
comment on column public.amap_leg_cache.distance_meters is '距离（米）';
comment on column public.amap_leg_cache.duration_seconds is '时长（秒）；步行偶尔没给时长，允许为 0';
comment on column public.amap_leg_cache.updated_at is '写入 / 覆盖时间，超过 TTL 视为未命中并重新请求覆盖';

-- 只有 service_role 能读写（service_role 绕过 RLS）；不放开任何 anon / authenticated 策略。
alter table public.amap_leg_cache enable row level security;

-- ==================== ② 每日各服务用量 ====================
create table if not exists public.amap_usage (
  day      date    not null,
  service  text    not null,
  calls    integer not null default 0,
  failures integer not null default 0,
  primary key (day, service)
);

comment on table public.amap_usage is
  '高德各服务每日调用次数 / 失败次数；数据源为 lib/amap.ts 的计数上报，供 A02「本月高德用量」看板与熔断降级使用';
comment on column public.amap_usage.service is
  '服务名：place_text / distance / direction_walking / direction_driving / direction_transit / direction_bicycling / other';
comment on column public.amap_usage.calls is '累计调用次数（含成功与失败）';
comment on column public.amap_usage.failures is '其中失败次数（高德返回 status != 1 或请求抛错）';

-- 同样只允许 service_role 读写；看板走服务端 service_role 查询，不对前端开放。
alter table public.amap_usage enable row level security;

-- ==================== ③ 用量原子累加函数 ====================
-- PostgREST 无法直接做 calls = calls + n 的原子更新，必须走 SQL 函数。
-- security definer + 空 search_path；只允许 service_role 调用（revoke public / anon / authenticated），
-- 避免前端通过 rpc 刷量。
create or replace function public.bump_amap_usage(
  p_day      date,
  p_service  text,
  p_calls    integer,
  p_failures integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.amap_usage (day, service, calls, failures)
  values (p_day, p_service, greatest(p_calls, 0), greatest(p_failures, 0))
  on conflict (day, service) do update
    set calls    = public.amap_usage.calls    + excluded.calls,
        failures = public.amap_usage.failures + excluded.failures;
$$;

comment on function public.bump_amap_usage(date, text, integer, integer) is
  '高德用量原子累加（仅 service_role 可执行）；供 lib/amap.ts 计数上报与 A02 用量看板使用';

revoke all on function public.bump_amap_usage(date, text, integer, integer)
  from public, anon, authenticated;
-- service_role 需要 execute 才能通过 PostgREST rpc 调用（换环境时同样可用）。
grant execute on function public.bump_amap_usage(date, text, integer, integer) to service_role;

-- 说明：service_role 已 bypassrls，可读写上面两张表；如需在权限收紧的环境显式授权，可执行：
--   grant select, insert, update on public.amap_leg_cache to service_role;
--   grant select, insert, update on public.amap_usage     to service_role;

-- 020_member_quota.sql
-- 用途：阶段 2「会员分层」——每日用量计数表 + 免费用户永久 1 次多日试用额度字段。
--
-- 背景：会员分层需要按「角色档位」做服务端限额（免费每天生成路线 1 次 / AI 提取 2 次、
--       单日地点 ≤6、只能单日；会员每天 10 次 / 20 次、单日地点 ≤12、多日 ≤7 天；
--       管理员不限）。判定数据源必须是服务端可信计数，故新增 public.user_daily_usage，
--       由服务端在实际动作里原子累加（禁止只靠前端）。
--
--   ① public.users.trial_multi_day_used —— 免费用户永久 1 次多日行程额度是否已用
--   ② public.user_daily_usage           —— 每人每天每类动作的次数
--   ③ public.bump_user_daily_usage(...)  —— 原子累加函数（仅 service_role 可执行）
--   ④ public.get_user_daily_usage(...)   —— 读取当天次数函数（仅 service_role 可执行）
--
-- 说明：不复用 public.events——events 由前端直接插入、且 event_name 里没有「AI 提取」事件，
--       既不可信也无法区分「生成路线 / 提取地点」，故单独建表统计。
--
-- 幂等性：可重复执行（add column if not exists / create ... if not exists / create or replace）。

-- ==================== ① 免费用户多日试用额度字段 ====================
alter table public.users
  add column if not exists trial_multi_day_used boolean not null default false;

comment on column public.users.trial_multi_day_used is
  '免费用户「永久 1 次多日行程」试用额度是否已用；true 后免费用户只能创建单日，多日需升级会员（管理员不受此限）';

-- ==================== ② 每人每天每类动作计数 ====================
create table if not exists public.user_daily_usage (
  user_id uuid    not null references public.users (id) on delete cascade,
  day     date    not null,
  kind    text    not null check (kind in ('generate_route', 'ai_extract')),
  count   integer not null default 0,
  primary key (user_id, day, kind)
);

comment on table public.user_daily_usage is
  '每人每天每类动作次数（服务端限额判定的数据源）；由服务端原子累加函数写入，前端不可读写';
comment on column public.user_daily_usage.day   is '服务器本地日期（YYYY-MM-DD），「每天」限额按此口径';
comment on column public.user_daily_usage.kind  is 'generate_route=生成路线 / ai_extract=AI 提取，取值见 config/enums.ts USAGE_KIND';
comment on column public.user_daily_usage.count is '当天累计次数';

-- 只有 service_role 能读写（service_role 绕过 RLS）；不放开任何 anon / authenticated 策略。
alter table public.user_daily_usage enable row level security;

-- ==================== ③ 原子累加函数 ====================
-- PostgREST 无法直接做 count = count + n 的原子更新，必须走 SQL 函数。
-- security definer + 空 search_path；只允许 service_role 调用（revoke public / anon / authenticated），
-- 避免前端通过 rpc 刷量。
create or replace function public.bump_user_daily_usage(
  p_user_id uuid,
  p_day     date,
  p_kind    text,
  p_count   integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_daily_usage (user_id, day, kind, count)
  values (p_user_id, p_day, p_kind, greatest(p_count, 0))
  on conflict (user_id, day, kind) do update
    set count = public.user_daily_usage.count + excluded.count;
$$;

comment on function public.bump_user_daily_usage(uuid, date, text, integer) is
  '每人每天每类动作次数原子累加（仅 service_role 可执行）；供服务端限额计数使用';

revoke all on function public.bump_user_daily_usage(uuid, date, text, integer)
  from public, anon, authenticated;
grant execute on function public.bump_user_daily_usage(uuid, date, text, integer) to service_role;

-- ==================== ④ 读取函数 ====================
create or replace function public.get_user_daily_usage(
  p_user_id uuid,
  p_day     date,
  p_kind    text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.count
       from public.user_daily_usage u
      where u.user_id = p_user_id
        and u.day = p_day
        and u.kind = p_kind),
    0
  );
$$;

comment on function public.get_user_daily_usage(uuid, date, text) is
  '读取某人某天某类动作次数（仅 service_role 可执行）；不存在返回 0';

revoke all on function public.get_user_daily_usage(uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.get_user_daily_usage(uuid, date, text) to service_role;

-- 说明：service_role 已 bypassrls，可读写 user_daily_usage；如需在权限收紧的环境显式授权，可执行：
--   grant select, insert, update on public.user_daily_usage to service_role;

-- 021_member_paid_and_share.sql
-- 阶段 3：① 会员付费开通（收款码人工核销） ② 路线长图导出 / 二维码分享 / 会员导入
-- 全部语句幂等，可重复执行（drop constraint if exists 后再 add / add column if not exists / create table if not exists）。
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

-- ==================== ① 会员付费开通 ====================

-- 1) 扩展 users.member_source 约束：原允许 ('self', 'admin')，新增 'paid'（付费开通）
alter table public.users drop constraint if exists users_member_source_check;
alter table public.users
  add constraint users_member_source_check
  check (member_source is null or member_source in ('self', 'admin', 'paid'));

comment on column public.users.member_source is '开通来源：self=用户自助升级 / admin=管理员开通 / paid=付费开通，见 config/enums.ts MEMBER_SOURCE';

-- 2) 新增 users.member_until（可空；null = 永久会员）
alter table public.users
  add column if not exists member_until timestamptz;

comment on column public.users.member_until is '会员到期时间；null = 永久会员（付费开通按套餐写入，见 config/business.ts MEMBER_PLANS）';

-- 3) 扩展 member_logs.source 约束：原允许 ('self', 'admin')，新增 'paid'
alter table public.member_logs drop constraint if exists member_logs_source_check;
alter table public.member_logs
  add constraint member_logs_source_check
  check (source in ('self', 'admin', 'paid'));

comment on column public.member_logs.source is '开通来源：self / admin / paid，见 config/enums.ts MEMBER_SOURCE';

-- 4) 会员付费订单（收款码人工核销）
create table if not exists public.member_orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  plan          text not null check (plan in ('month', 'year', 'forever')),
  amount_cents  integer not null check (amount_cents > 0),
  pay_note      text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.users (id) on delete set null
);

create index if not exists member_orders_user_idx
  on public.member_orders (user_id, created_at desc);
create index if not exists member_orders_status_idx
  on public.member_orders (status, created_at desc);

alter table public.member_orders enable row level security;
grant select on public.member_orders to authenticated;

-- 登录用户只能 select 自己的订单；不开放 insert / update 策略（写入走服务端 service_role）。
drop policy if exists member_orders_select_own on public.member_orders;
create policy member_orders_select_own on public.member_orders
  for select to authenticated
  using (auth.uid() = user_id);

comment on table  public.member_orders                is '会员付费订单（收款码人工核销）；写入由服务端接口用 Secret Key 完成';
comment on column public.member_orders.plan           is 'month / year / forever，见 config/enums.ts MEMBER_PLAN';
comment on column public.member_orders.amount_cents   is '金额（分），由服务端按套餐写入，绝不信任前端传入';
comment on column public.member_orders.pay_note       is '用户填写的付款备注 / 交易单号，供管理员核对';
comment on column public.member_orders.status         is 'pending=待核销 / approved=已开通 / rejected=已驳回，见 config/enums.ts ORDER_STATUS';
comment on column public.member_orders.reject_reason  is '驳回原因（status=rejected 时填写）';
comment on column public.member_orders.reviewed_by    is '核销管理员';

-- 5) 路线分享令牌（长图 / 二维码分享；交付 B 用）
create table if not exists public.route_shares (
  token      text primary key,
  route_id   uuid not null references public.routes (id) on delete cascade,
  owner_id   uuid not null references public.users (id) on delete cascade,
  snapshot   jsonb not null,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists route_shares_owner_idx on public.route_shares (owner_id);
create index if not exists route_shares_route_idx on public.route_shares (route_id);

alter table public.route_shares enable row level security;
-- 不建任何策略：仅 service_role（服务端 admin 客户端）可读写，分享页由服务端读取。

comment on table  public.route_shares            is '路线分享令牌；分享页由服务端 admin 客户端读取，不建策略';
comment on column public.route_shares.token      is '分享令牌（crypto.randomBytes(9).toString(base64url)，仅服务端生成）';
comment on column public.route_shares.snapshot   is '自包含路线快照（不依赖原路线权限），见 lib/route-share.ts RouteShareSnapshot';
comment on column public.route_shares.view_count is '分享页被打开次数（服务端累加，失败静默）';
comment on column public.route_shares.revoked_at is '作废时间；非空表示该令牌已失效';

-- 6) 防提权补齐：014 的守卫只覆盖 member / member_since / member_source，
--    而 009 的 users_update_self 策略允许登录用户改自己那一行，
--    新增的 member_until（付费到期）与 trial_multi_day_used（免费多日试用额度）若不纳入守卫，
--    已过期会员可自行把 member_until 改到未来、免费用户可把 trial_multi_day_used 改回 false 反复白嫖多日行程。
--    判断方式与 010 / 014 完全一致：auth.uid() 为 null（service_role / SQL Editor）放行，登录态只有管理员可改。
--    幂等：create or replace（覆盖 014 建立的同名函数，触发器本身无需重建）。
create or replace function public.prevent_member_self_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.member is distinct from old.member
      or new.member_since is distinct from old.member_since
      or new.member_source is distinct from old.member_source
      or new.member_until is distinct from old.member_until
      or new.trial_multi_day_used is distinct from old.trial_multi_day_used)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'FORBIDDEN: 只有管理员可以修改会员字段' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.prevent_member_self_grant() is '禁止普通用户自行修改用户身份（member / member_since / member_source / member_until / trial_multi_day_used），只允许管理员或服务端修改，见 014_member_guard.sql 与 021_member_paid_and_share.sql';

-- 022_member_order_pay_channel.sql
-- 阶段 3 补充：会员付费订单记录付款通道（微信 / 支付宝收款码）。
-- 收银台新增支付宝收款码后，订单必须写明用户扫的是哪个通道，管理员核销时才知道去哪个收款账户对账。
-- 全部语句幂等，可重复执行（add column if not exists / drop constraint if exists 后再 add）。

-- 1) 新增 member_orders.pay_channel（默认 wechat：022 之前只有微信收款码一个通道）
alter table public.member_orders
  add column if not exists pay_channel text not null default 'wechat';

-- 2) 取值约束（与 config/enums.ts PAY_CHANNEL 逐字一致）
alter table public.member_orders drop constraint if exists member_orders_pay_channel_check;
alter table public.member_orders
  add constraint member_orders_pay_channel_check
  check (pay_channel in ('wechat', 'alipay'));

comment on column public.member_orders.pay_channel is '付款通道：wechat=微信支付 / alipay=支付宝，见 config/enums.ts PAY_CHANNEL 与 config/business.ts MEMBER_PAY_CHANNELS；由服务端按前端所选通道写入';

-- 023_amap_geocode_cache.sql
-- 用途：高德文本搜索（v3/place/text）结果落库缓存（阶段：额度降本第 2 步）。
--
-- 背景：place/text 是唯一没有缓存的环节，却是最贵的环节 ——
--       导入文案补地点坐标（app/api/places/route.ts 每个地点 1 次）、
--       住宿坐标解析（route/[id]/page.tsx 与 route/[id]/places/page.tsx 每次进页面都搜 1~2 次）、
--       U06 手动搜索地点（app/api/amap/search/route.ts）全都直接打高德。
--       同一城市 + 同一关键词被反复搜，额度被重复消耗。
--   public.amap_geocode_cache —— 以 (city, keywords) 为键缓存归一化后的 POI 数组，跨进程 / 跨用户共享。
--
-- 幂等性：可重复执行（create ... if not exists）。

create table if not exists public.amap_geocode_cache (
  city       text        not null,
  keywords   text        not null,
  results    jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (city, keywords)
);

comment on table public.amap_geocode_cache is
  '高德文本搜索（place/text）结果落库缓存，键为 (city, keywords)，TTL 见 config/business.ts AMAP_CACHE_TTL_DAYS，超过视为未命中并重新请求覆盖；只缓存搜到结果的关键词，空结果不缓存（避免「永久搜不到」）';
comment on column public.amap_geocode_cache.city is '搜索时传入的城市名（place/text 的 city 参数），与关键词共同构成缓存键';
comment on column public.amap_geocode_cache.keywords is '搜索关键词（地点名 / 住宿名 / 住宿区域），与城市共同构成缓存键';
comment on column public.amap_geocode_cache.results is
  '归一化后的 POI 数组（name / address / lat / lng / imageUrl），供 lib/amap.ts searchPlaces 直接复用，命中时不消耗高德额度';
comment on column public.amap_geocode_cache.updated_at is '写入 / 覆盖时间，超过 TTL 视为未命中并重新请求覆盖';

-- 只有 service_role 能读写（service_role 绕过 RLS）；不放开任何 anon / authenticated 策略。
alter table public.amap_geocode_cache enable row level security;

-- 024_amap_usage_key_pool.sql
-- 用途：高德多账号 Key 池 —— 用量表增加 Key 槽位维度（阶段：多账号叠加额度）。
--
-- 背景：单个高德个人认证账号 Web 服务配额 15 万次/月（硬顶）。为了叠加额度，项目支持配置多个
--       高德账号的「Web服务」Key（.env.local：AMAP_WEB_SERVICE_KEY / _2 / _3），服务端轮询使用。
--       因此用量统计必须能区分是「哪个 Key（哪个账号）」的调用：
--   ① public.amap_usage 增加 key_slot 列（槽位下标，与 config/env.ts AMAP_WEB_KEYS 顺序一致），
--      主键由 (day, service) 扩为 (day, service, key_slot)，历史行 key_slot 默认 0（即第一个 Key）。
--   ② bump_amap_usage 改为 5 参版本（多 p_key_slot），并删掉旧的 4 参版本避免重载歧义。
--
-- 幂等性：可重复执行（add column if not exists / drop ... if exists / create or replace）。

-- ① 增加 Key 槽位维度
alter table public.amap_usage
  add column if not exists key_slot integer not null default 0;

comment on column public.amap_usage.key_slot is
  'Key 槽位下标（0 起）：与 config/env.ts 的 AMAP_WEB_KEYS 顺序一致，用于区分不同高德账号的用量；历史数据默认 0（第一个 Key）';

-- 主键由 (day, service) 扩为 (day, service, key_slot)，同一天同一服务可按 Key 分别累计
alter table public.amap_usage drop constraint if exists amap_usage_pkey;
alter table public.amap_usage add constraint amap_usage_pkey primary key (day, service, key_slot);

-- ② 用量原子累加函数（含 Key 槽位）；先删旧 4 参重载，避免 PostgREST 按函数名解析到旧签名
drop function if exists public.bump_amap_usage(date, text, integer, integer);
drop function if exists public.bump_amap_usage(date, text, integer, integer, integer);

create or replace function public.bump_amap_usage(
  p_day      date,
  p_service  text,
  p_key_slot integer,
  p_calls    integer,
  p_failures integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.amap_usage (day, service, key_slot, calls, failures)
  values (p_day, p_service, greatest(p_key_slot, 0), greatest(p_calls, 0), greatest(p_failures, 0))
  on conflict (day, service, key_slot) do update
    set calls    = public.amap_usage.calls    + excluded.calls,
        failures = public.amap_usage.failures + excluded.failures;
$$;

comment on function public.bump_amap_usage(date, text, integer, integer, integer) is
  '高德用量原子累加（仅 service_role 可执行）；p_key_slot 为 Key 槽位下标，供 lib/amap.ts 计数上报与多账号用量看板使用';

revoke all on function public.bump_amap_usage(date, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.bump_amap_usage(date, text, integer, integer, integer) to service_role;

-- 025_route_monthly_quota.sql
-- 「生成路线」限额按身份分周期：免费按天（每天 1 条）、会员按月（每月 10 条）。
-- 复用 020 的 user_daily_usage：按天桶 kind = generate_route（day 存日期），
-- 按月桶 kind = generate_route_month（day 存当月 1 号），主键 (user_id, day, kind) 天然隔离。
alter table public.user_daily_usage
  drop constraint if exists user_daily_usage_kind_check;

alter table public.user_daily_usage
  add constraint user_daily_usage_kind_check
  check (kind in ('generate_route', 'generate_route_month', 'ai_extract'));

comment on column public.user_daily_usage.day is
  '计数周期键：按天桶存服务器本地日期（YYYY-MM-DD）「每天」限额按此口径；按月桶存当月 1 号（YYYY-MM-01）「每月」限额按此口径';

comment on column public.user_daily_usage.kind is
  'generate_route=生成路线·免费按天 / generate_route_month=生成路线·会员按月 / ai_extract=AI 提取，取值见 config/enums.ts USAGE_KIND';
