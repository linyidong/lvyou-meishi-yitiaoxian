-- 004_create_routes.sql
-- routes：用户生成的旅行路线。

create table if not exists public.routes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  city_id     uuid references public.cities (id) on delete set null,
  title       text not null,
  days        int not null check (days >= 1),
  transport   text not null check (transport in ('walk', 'bike')),
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists routes_user_id_idx on public.routes (user_id);
create index if not exists routes_city_id_idx on public.routes (city_id);

comment on table  public.routes           is '用户路线，is_public 对应 B11 公开路线（第一版关闭）';
comment on column public.routes.days      is '天数，上限 MAX_DAYS(B02) 由应用层校验，此处只约束 >=1';
comment on column public.routes.transport is 'walk / bike，取值见 config/enums.ts TRANSPORT（E03/E04）';
