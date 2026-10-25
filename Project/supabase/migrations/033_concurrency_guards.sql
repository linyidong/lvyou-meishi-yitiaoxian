-- 033_concurrency_guards.sql
-- T-054：修复并发审计 R3（下单 check-then-insert 非原子）与 R4（建路线配额 check-then-act 非原子）。
--   依据：docs/concurrency-audit.md §1/§4、tasks/T-054.md §3 方案 A。
--   模式参照迁移 027（R1/R2 同法已修）：pg_advisory_xact_lock + 计数 + 写入在同一函数（= 同一事务）内完成。
-- 全部语句幂等，可重复执行（create or replace / 显式按角色 revoke+grant，见 027 教训：
--   Supabase 默认权限会直接授 anon/authenticated/service_role，revoke from public 撤不掉直接授予）。
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run（由 Harness 执行）。
--
-- 语义口径（与改造前应用层完全一致，不改限额值/错误文案）：
--   ① create_member_order_guarded：待核销（status='pending'）订单数 >= p_max_pending 时拒绝；
--      p_max_pending 由 API 传 BUSINESS.MAX_PENDING_ORDERS（当前=2）。
--   ② create_route_guarded：按档位周期桶（免费按天 generate_route / 会员按月 generate_route_month）
--      计数 >= p_limit 时拒绝；否则插入 routes + 累加计数 +（可选）置 trial_multi_day_used，同事务。
--      p_limit 由 API 按现有 getRouteQuota 口径传入（会员取后台设置、免费取 BUSINESS）。
--   管理员不计数不校验，API 层不调本函数（保持原直插路径）。

-- ==================== ① R3：会员下单原子占额 ====================
create or replace function public.create_member_order_guarded(
  p_user_id     uuid,
  p_plan        text,
  p_amount      integer,
  p_channel     text,
  p_note        text,
  p_max_pending integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count    integer;
  v_order_id uuid;
begin
  -- 参数兜底：上限必须为正整数（套餐/通道/金额合法性由 API 层先行校验，
  -- 库层 check 约束（021/022）仍会拦截非法值，函数内不重复维护枚举）。
  if p_max_pending is null or p_max_pending < 1 then
    raise exception 'INVALID_MAX_PENDING: p_max_pending must be a positive integer' using errcode = '22023';
  end if;

  -- 同一用户的下单串行化；锁随事务结束自动释放。
  -- hashtext 理论上可能哈希碰撞（不同用户撞同一锁），后果仅是多一次串行，不影响正确性。
  perform pg_advisory_xact_lock(hashtext('member_order:' || p_user_id::text));

  select count(*) into v_count
    from public.member_orders
   where user_id = p_user_id
     and status = 'pending';

  if v_count >= p_max_pending then
    return jsonb_build_object('result', 'LIMIT', 'pending_count', v_count);
  end if;

  insert into public.member_orders (user_id, plan, amount_cents, pay_note, pay_channel, status)
  values (p_user_id, p_plan, p_amount, p_note, p_channel, 'pending')
  returning id into v_order_id;

  return jsonb_build_object('result', 'OK', 'order_id', v_order_id);
end;
$$;

comment on function public.create_member_order_guarded(uuid, text, integer, text, text, integer) is
  'T-054/R3：下单原子占额（advisory 锁→计数 pending→插入，单事务）。返回 {result: OK|LIMIT, order_id|pending_count}。仅 service_role 可调。见 docs/concurrency-audit.md §1';

-- 最小授权：仅 service_role 可调（调用方为 createAdminClient）。
revoke all on function public.create_member_order_guarded(uuid, text, integer, text, text, integer) from public;
revoke execute on function public.create_member_order_guarded(uuid, text, integer, text, text, integer) from anon, authenticated;
grant execute on function public.create_member_order_guarded(uuid, text, integer, text, text, integer) to service_role;

-- ==================== ② R4：建路线配额原子占额 ====================
create or replace function public.create_route_guarded(
  p_user_id    uuid,
  p_kind       text,
  p_period_key date,
  p_limit      integer,
  p_payload    jsonb,
  p_mark_trial boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used     integer;
  v_route_id uuid;
begin
  -- 参数兜底：限额必须为正整数；kind 只允许「生成路线」两个桶（防止经本函数刷其它计数）；
  -- 周期桶键与 kind 的对应关系（按天=当天 / 按月=当月 1 号）由 API 层按 lib/member-quota.ts 口径传入。
  if p_limit is null or p_limit < 1 then
    raise exception 'INVALID_LIMIT: p_limit must be a positive integer' using errcode = '22023';
  end if;
  if p_kind not in ('generate_route', 'generate_route_month') then
    raise exception 'INVALID_KIND: p_kind must be a route usage bucket' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_PAYLOAD: p_payload must be a json object' using errcode = '22023';
  end if;

  -- 同一用户的「配额检查 + 建路线 + 计数」串行化。
  perform pg_advisory_xact_lock(hashtext('route:' || p_user_id::text));

  select coalesce((
    select u.count
      from public.user_daily_usage u
     where u.user_id = p_user_id
       and u.day = p_period_key
       and u.kind = p_kind
  ), 0) into v_used;

  if v_used >= p_limit then
    return jsonb_build_object('result', 'LIMIT', 'used', v_used, 'remaining', 0);
  end if;

  -- 插入列清单与迁移 004/013 的 routes 列一一对应；user_id 一律取参数、不信任 payload；
  -- title/days/transport 等值域校验由 API 层先行 + 库层 check 约束兜底。
  insert into public.routes (user_id, city_id, title, days, transport,
                             origin_city, intercity_mode, lodging_type,
                             lodging_name, lodging_area, lodging_nights)
  select p_user_id, r.city_id, r.title, r.days, r.transport,
         r.origin_city, r.intercity_mode, r.lodging_type,
         r.lodging_name, r.lodging_area, r.lodging_nights
    from jsonb_populate_record(null::public.routes, p_payload) r
  returning id into v_route_id;

  -- 计数累加（口径与 bump_user_daily_usage 一致，同事务内直接写）。
  insert into public.user_daily_usage (user_id, day, kind, count)
  values (p_user_id, p_period_key, p_kind, 1)
  on conflict (user_id, day, kind) do update
    set count = public.user_daily_usage.count + 1;

  -- 免费用户「永久 1 次多日行程」试用额度置位（仅 API 判定本次走试用额度时传入）。
  if p_mark_trial then
    update public.users
       set trial_multi_day_used = true
     where id = p_user_id;
  end if;

  return jsonb_build_object('result', 'OK', 'route_id', v_route_id, 'remaining', p_limit - v_used - 1);
end;
$$;

comment on function public.create_route_guarded(uuid, text, date, integer, jsonb, boolean) is
  'T-054/R4：建路线配额原子占额（advisory 锁→周期计数→插入 routes→累加计数→可选置试用额度，单事务）。返回 {result: OK|LIMIT, route_id|remaining}。仅 service_role 可调。见 docs/concurrency-audit.md §4';

-- 最小授权：仅 service_role 可调（调用方为 createAdminClient）。
revoke all on function public.create_route_guarded(uuid, text, date, integer, jsonb, boolean) from public;
revoke execute on function public.create_route_guarded(uuid, text, date, integer, jsonb, boolean) from anon, authenticated;
grant execute on function public.create_route_guarded(uuid, text, date, integer, jsonb, boolean) to service_role;

-- ==================== 回滚（如需，在 Studio 手动执行以下两条） ====================
-- drop function if exists public.create_route_guarded(uuid, text, date, integer, jsonb, boolean);
-- drop function if exists public.create_member_order_guarded(uuid, text, integer, text, text, integer);
