-- 015_admin_default_member.sql
-- 管理员账号默认享有最高级会员：管理员的会员权益由「账号角色」自动决定，不依赖手工开通。
--
-- 背景：A03 用户列表原先对所有账号都提供「开通 / 取消会员」按钮，管理员账号也被当成普通
-- 账号处理，导致不能直观对比「会员 vs 普通用户」。本迁移把 admin 视为会员权益的最高等级：
--   ① 现有 admin 行一次性回填 member 字段；
--   ② 之后任何把 role 设为 admin 的操作，都会自动带上会员字段；
--   ③ 反向保护：admin 的会员字段不允许被取消（仅允许写入 true）。
--
-- 说明：member_source 使用 'admin'（见 config/enums.ts MEMBER_SOURCE.ADMIN），
-- 语义为「由管理员身份自动获得」，与 A03 的「管理员开通」复用同一枚举值，界面按角色区分展示。

-- ============================ ① 回填现有管理员 ============================
update public.users
   set member        = true,
       member_since  = coalesce(member_since, now()),
       member_source = 'admin'
 where role = 'admin'
   and (member is not true or member_source is null);

-- ============================ ② 自动同步触发器 ============================
-- 在 010 的 prevent_role_change 之外单独建一个 BEFORE 触发器：
-- 不拦截任何写入，只负责把 admin 行的会员字段补齐，因此不会与 010 / 014 冲突。
create or replace function public.sync_admin_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'admin' then
    -- 管理员必须是会员，且不允许被取消（取消会员的操作对 admin 行无效）
    new.member        := true;
    new.member_since  := coalesce(new.member_since, old.member_since, now());
    new.member_source := 'admin';
  end if;
  return new;
end;
$$;

comment on function public.sync_admin_member() is
  'BEFORE UPDATE 触发器函数：把 admin 行的会员字段强制补齐为最高级会员';

drop trigger if exists users_admin_default_member on public.users;
create trigger users_admin_default_member
  before update on public.users
  for each row
  execute function public.sync_admin_member();

-- 说明：本触发器只覆盖 UPDATE。INSERT（新管理员）通常由 010 的 handle_new_user 写入，
-- 且 014 已禁止普通用户自助修改 member/role，故无需再挂 BEFORE INSERT。

-- ============================ ③ 自检 ============================
-- 执行后可运行下面两句确认：
--   select email, role, member, member_since, member_source from public.users where role = 'admin';
--   select tgname from pg_trigger where tgrelid = 'public.users'::regclass;
-- 期望：管理员行 member = true；触发器列表中出现 users_admin_default_member。
