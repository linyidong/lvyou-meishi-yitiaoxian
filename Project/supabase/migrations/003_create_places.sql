-- 003_create_places.sql
-- places：用户地点库（景点 / 美食），来源见 imports.source。

create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  city_id     uuid references public.cities (id) on delete set null,
  name        text not null,
  address     text,
  type        text not null check (type in ('attraction', 'food')),
  note        text,
  image_url   text,
  open_hours  text,
  rating      numeric(2, 1) check (rating >= 0),
  lat         numeric(10, 6) check (lat >= -90 and lat <= 90),
  lng         numeric(10, 6) check (lng >= -180 and lng <= 180),
  source_url  text,
  created_at  timestamptz not null default now()
);

create index if not exists places_user_id_idx on public.places (user_id);
create index if not exists places_city_id_idx on public.places (city_id);

comment on table  public.places      is '用户地点库，坐标由高德搜索写入';
comment on column public.places.type is 'attraction=景点 / food=美食（存枚举值，展示时用 *_LABEL 映射）';
