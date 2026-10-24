-- 032_app_settings.sql
-- T-049：后台「设置」的持久化存储（单行 key='global'，value 为 JSON）。
-- 仅服务端（service_role）读写；不对普通用户开放。
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- 不建任何策略：anon/authenticated 无法读写，只有 service_role 绕过 RLS。

-- 回滚：drop table if exists public.app_settings;
