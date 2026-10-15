-- 014_member_guard.sql
-- 防提权：users_update_self 策略允许用户改自己那一行，必须挡住把 member 三列自己改成会员。
-- 与 010_triggers.sql 的 prevent_role_change 保持同一套判断方式：
--   1) auth.uid() is null（service_role / SQL Editor 直连）→ 放行，
--      因此 /api/member（用户自助升级）与 /api/admin/member（管理员操作）走服务端 Secret Key 不受影响；
--   2) 走登录态时，只有 public.is_admin() 为真才允许改，普通用户改这三列会被拦下（42501）。
-- 幂等：可重复执行。

create or replace function public.prevent_member_self_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.member is distinct from old.member
      or new.member_since is distinct from old.member_since
      or new.member_source is distinct from old.member_source)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'FORBIDDEN: 只有管理员可以修改会员字段' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.prevent_member_self_grant() is '禁止普通用户自行修改用户身份（member / member_since / member_source），只允许管理员或服务端修改，见 014_member_guard.sql';

drop trigger if exists users_prevent_member_self_grant on public.users;
create trigger users_prevent_member_self_grant
  before update on public.users
  for each row execute function public.prevent_member_self_grant();
