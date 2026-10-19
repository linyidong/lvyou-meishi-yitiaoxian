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
