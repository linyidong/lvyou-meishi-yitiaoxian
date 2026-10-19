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
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

-- ==================== ① 增加 Key 槽位维度 ====================
alter table public.amap_usage
  add column if not exists key_slot integer not null default 0;

comment on column public.amap_usage.key_slot is
  'Key 槽位下标（0 起）：与 config/env.ts 的 AMAP_WEB_KEYS 顺序一致，用于区分不同高德账号的用量；历史数据默认 0（第一个 Key）';

-- 主键由 (day, service) 扩为 (day, service, key_slot)，同一天同一服务可按 Key 分别累计
alter table public.amap_usage drop constraint if exists amap_usage_pkey;
alter table public.amap_usage add constraint amap_usage_pkey primary key (day, service, key_slot);

-- ==================== ② 用量原子累加函数（含 Key 槽位） ====================
-- PostgREST 无法直接做 calls = calls + n 的原子更新，必须走 SQL 函数。
-- security definer + 空 search_path；只允许 service_role 调用（revoke public / anon / authenticated），
-- 避免前端通过 rpc 刷量。
-- 先删掉旧的 4 参重载，避免 PostgREST 按函数名解析到旧签名。
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
-- service_role 需要 execute 才能通过 PostgREST rpc 调用（换环境时同样可用）。
grant execute on function public.bump_amap_usage(date, text, integer, integer, integer) to service_role;
