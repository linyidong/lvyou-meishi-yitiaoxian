-- 034_feedback.sql
-- T-098 功能建议：用户按「页面 → 功能」提交建议，后台意见箱聚合查看。
-- 仅登录用户可写自己的建议；普通用户只能看自己的，管理员通过 service_role 读取全部。

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_key text not null,
  feature_key text not null,
  content text not null check (char_length(content) between 5 and 1000),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_page_idx on public.feedback (page_key, feature_key);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select to authenticated
  using (auth.uid() = user_id);

grant select, insert on public.feedback to authenticated;
-- 后台意见箱用 service_role 读取与更新（RLS 绕过，但仍需表权限）
grant select, insert, update, delete on public.feedback to service_role;

-- 回滚：
-- drop policy if exists feedback_select_own on public.feedback;
-- drop policy if exists feedback_insert_own on public.feedback;
-- drop table if exists public.feedback;
