-- 001_create_users.sql
-- users：用户表，id 与 auth.users 一一对应，注册时由 010 的触发器写入。

create table if not exists public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text unique,
  username      text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  last_seen_at  timestamptz,
  current_path  text,
  created_at    timestamptz not null default now()
);

comment on table  public.users               is '用户表，id 与 auth.users 同步，role 控制管理员权限';
comment on column public.users.role          is 'user / admin，取值见 config/enums.ts USER_ROLE（E10/E11）';
comment on column public.users.last_seen_at  is '最后活跃时间，由 /api/heartbeat 更新；在线判定阈值见 B04';
comment on column public.users.current_path  is '当前所在页面，由 /api/heartbeat 更新';
