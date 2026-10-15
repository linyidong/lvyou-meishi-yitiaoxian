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
