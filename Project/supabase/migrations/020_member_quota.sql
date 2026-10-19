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
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

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
