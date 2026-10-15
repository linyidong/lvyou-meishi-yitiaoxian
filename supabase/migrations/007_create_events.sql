-- 007_create_events.sql
-- events：埋点事件，前端直接插入 Supabase。

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  event_name  text not null check (event_name in ('add_place', 'generate_route', 'click_upgrade')),
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_name_created_at_idx on public.events (event_name, created_at desc);

comment on table  public.events            is '埋点事件，见 技术方案 v1.1 §4.9';
comment on column public.events.event_name is 'add_place / generate_route / click_upgrade，见 config/enums.ts EVENT_NAME（E12-E14）';
