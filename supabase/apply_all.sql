-- apply_all.sql
-- 由 supabase/migrations/001~011 依次拼接而成，仅用于在 Supabase SQL Editor 一次性导入。
-- 请勿单独修改本文件；改动请改 001~011 后重新生成。

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
