-- apply_012_013.sql
-- 增量升级包：只包含 012 + 013 的改动，用于在已建库的 Supabase 上补结构。
-- 在 Supabase SQL Editor 中整段执行一次即可（全部语句幂等，重复执行无副作用）。
-- 基础建库脚本仍为 apply_all.sql（001~011），本文件不重复包含。

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
