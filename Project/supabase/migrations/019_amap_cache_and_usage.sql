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
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

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
