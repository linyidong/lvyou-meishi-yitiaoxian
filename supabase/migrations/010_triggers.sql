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
