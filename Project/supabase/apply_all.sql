-- apply_all.sql
-- 由 supabase/migrations/001~014 依次拼接而成，用于在全新 Supabase 环境一次性导入建库。
-- 若库已按 001~011 建好，只需执行 apply_012_013.sql（增量升级包）+ 014_member_guard.sql。
-- 请勿单独修改本文件；改动请改 001~014 后重新生成。

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
  transport   text not null check (transport in ('walk', 'bike')),
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists routes_user_id_idx on public.routes (user_id);
create index if not exists routes_city_id_idx on public.routes (city_id);

comment on table  public.routes           is '用户路线，is_public 对应 B11 公开路线（第一版关闭）';
comment on column public.routes.days      is '天数，上限 MAX_DAYS(B02) 由应用层校验，此处只约束 >=1';
comment on column public.routes.transport is 'walk / bike，取值见 config/enums.ts TRANSPORT（E03/E04）';

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
