-- 027_atomic_replace_and_approve.sql
-- T-020：修复并发审计 R1（保存点位「先删后插」无事务）与 R2（核销无 CAS）。
--   依据：docs/concurrency-audit.md §0/§2/§3、tasks/T-020.md。
-- 全部语句幂等，可重复执行（drop constraint if exists 后再 add / create or replace / 显式 revoke+grant）。
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run（由 Harness 执行）。
--
-- 执行前复查（必须，两条 SELECT 均须返回 0 才可执行本文件）：
--   select count(*) from (select route_id,day_index,order_index from public.route_places group by 1,2,3 having count(*)>1) t;
--   select count(*) from (select route_id,place_id           from public.route_places group by 1,2           having count(*)>1) t;
-- （2026-10-22 实测两口径均 0 重复、41 行 / 5 条路线；member_orders 现网 0 行。）
--
-- 回滚（只新增对象、不改任何存量数据，回滚零数据风险；语句见文件末尾「回滚」段）。

-- ==================== ① route_places 双口径唯一约束（兜底防重复行） ====================
-- slot 口径：同一天同一站位只允许一行（防并发交错插入导致 order_index 冲突、地图/里程错乱）。
alter table public.route_places
  drop constraint if exists route_places_slot_uniq;
alter table public.route_places
  add constraint route_places_slot_uniq unique (route_id, day_index, order_index);

-- place 口径：同一地点在同一路线只允许一行（防重复地点共存）。
alter table public.route_places
  drop constraint if exists route_places_route_place_uniq;
alter table public.route_places
  add constraint route_places_route_place_uniq unique (route_id, place_id);

-- 注：现有普通索引 route_places_route_id_idx 与 slot 唯一索引同列，变冗余但保留不动（避免混入无关变更）。

-- ==================== ② R1：路线点位原子替换函数 ====================
-- delete + insert 在同一函数内完成 = 同一事务（PostgREST 单次 RPC = 单条 SQL 请求 = 单个隐式事务）。
-- 插入失败（FK 违例 / 唯一冲突 / jsonb 结构非法）时 delete 一并回滚，原地点不被清空。
create or replace function public.replace_route_places(p_route_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  -- 归属校验：security definer 绕过 RLS，必须在函数内验证「路线属于当前登录用户」，
  -- 否则任何登录用户可直接经 PostgREST 调用本 RPC 清空任意路线。
  -- 口径与改造前 API（app/api/routes/[id]/places/route.ts 的 routes 归属查询）一致：只允许本人，不给管理员开口子。
  -- service_role 场景说明：service_role 请求无用户 JWT，auth.uid() 恒为 null → 本函数一律拒绝；
  -- 即本函数设计上仅允许用户会话（authenticated）调用。游客转正（promote）等 service_role 链路
  -- 不走本函数（其点位写入仍是独立 insert 循环，属 R4 范围，本迁移不扩大）。
  if not exists (
    select 1 from public.routes r
    where r.id = p_route_id
      and r.user_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN: route not owned by current user' using errcode = '42501';
  end if;

  -- 参数兜底校验（RPC 可被任意登录用户直接调用，数据库边界必须自证合法性；
  -- 单日配额 / place 归属等业务校验仍留在 API 层先行）。
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS: p_items must be a json array' using errcode = '22023';
  end if;

  delete from public.route_places where route_id = p_route_id;

  insert into public.route_places (route_id, place_id, day_index, order_index)
  select p_route_id, x.place_id, x.day_index, x.order_index
    from jsonb_to_recordset(p_items) as x(place_id uuid, day_index int, order_index int);

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

comment on function public.replace_route_places(uuid, jsonb) is
  'T-020/R1：单事务原子替换路线点位（delete+insert）。security definer + 函数内归属校验（仅本人路线，service_role 因 auth.uid()=null 被拒）。返回插入行数。见 docs/concurrency-audit.md §3';

-- 最小授权：仅用户会话可调（调用方是带用户 JWT 的服务端 client）。不授 anon / service_role。
-- 注意：Supabase 的默认权限（alter default privileges）会把 EXECUTE 直接授给 anon/authenticated/service_role，
-- `revoke ... from public` 撤不掉这些**直接授予**。必须显式按角色撤，否则 anon 可经 PostgREST 调本 RPC。
-- （2026-10-22 实测踩过：只写 revoke from public 时，anon/authenticated 仍可执行，已修正。）
revoke all on function public.replace_route_places(uuid, jsonb) from public;
revoke execute on function public.replace_route_places(uuid, jsonb) from anon, service_role;
grant execute on function public.replace_route_places(uuid, jsonb) to authenticated;

-- ==================== ③ R2：核销原子占用函数 ====================
-- 事务内顺序：CAS 占单（仅 pending 可翻转为 approved）→ 更新 users → 写 member_logs。
-- 任一步失败整体回滚：订单回到 pending、无 logs 残留、users 未动，无需应用层补偿。
create or replace function public.approve_member_order(p_order_id uuid, p_admin uuid, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if p_days is null or p_days <= 0 then
    raise exception 'INVALID_DAYS: p_days must be a positive integer' using errcode = '22023';
  end if;

  -- ① CAS 占单：状态翻转即闸门。并发双请求只有先到者能命中 status='pending'，
  --    后到者 0 行 → 返回 NOT_PENDING（不 raise：事务正常提交且无任何写入）。
  update public.member_orders
     set status = 'approved',
         reject_reason = null,
         reviewed_at = now(),
         reviewed_by = p_admin
   where id = p_order_id
     and status = 'pending'
   returning user_id into v_user;

  if not found then
    return jsonb_build_object('result', 'NOT_PENDING');
  end if;

  -- ② 置会员。member_until = now() + p_days 天，与改造前应用层口径
  --    （Date.now() + plan.days * DAY_MS）一致，仅时钟源从应用改为数据库（毫秒级差异）。
  --    p_days 由 API 按 BUSINESS.MEMBER_PLANS 查得后传入，套餐天数规则不在本函数改动。
  --    users 上的 prevent_member_self_grant 触发器（021）对 service_role 请求
  --    auth.uid()=null → 放行，与改造前 admin client 直写行为一致。
  update public.users
     set member = true,
         member_since = now(),
         member_source = 'paid',
         member_until = now() + make_interval(days => p_days)
   where id = v_user;

  if not found then
    -- 目标用户在预读后被删除等极端情况：raise → 整个事务回滚，订单回到 pending。
    raise exception 'TARGET_USER_MISSING' using errcode = 'P0002';
  end if;

  -- ③ 留痕。改造前此步无错误检查（失败静默）；现在失败 = 整体回滚，留痕缺失不再可能发生。
  insert into public.member_logs (target_user, action, operator_id, source)
  values (v_user, 'grant', p_admin, 'paid');

  return jsonb_build_object('result', 'OK', 'user_id', v_user);
end;
$$;

comment on function public.approve_member_order(uuid, uuid, integer) is
  'T-020/R2：核销原子占用（CAS 占单→users→member_logs，单事务，任一失败整体回滚）。返回 {result: OK|NOT_PENDING}。目标用户存在性与管理员角色校验仍在 API 层先行。见 docs/concurrency-audit.md §2';

-- 最小授权：仅 service_role 可调（调用方为 createAdminClient）。
-- 绝不授 authenticated —— 否则普通用户可经 PostgREST 直接调 RPC 翻订单/自开会员。
revoke all on function public.approve_member_order(uuid, uuid, integer) from public;
-- 同上：必须显式撤 anon/authenticated；此函数无调用者身份校验，若 anon 可执行 = 任意人可自开会员。
revoke execute on function public.approve_member_order(uuid, uuid, integer) from anon, authenticated;
grant execute on function public.approve_member_order(uuid, uuid, integer) to service_role;

-- ==================== 回滚（如需，在 Studio 手动执行以下四条） ====================
-- drop function if exists public.approve_member_order(uuid, uuid, integer);
-- drop function if exists public.replace_route_places(uuid, jsonb);
-- alter table public.route_places drop constraint if exists route_places_route_place_uniq;
-- alter table public.route_places drop constraint if exists route_places_slot_uniq;
