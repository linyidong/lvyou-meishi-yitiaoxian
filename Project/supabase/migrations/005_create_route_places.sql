-- 005_create_route_places.sql
-- route_places：路线与地点的关联（第几天、第几站）。
-- day_index / order_index 均为 0 基，与前端数组下标一致。

create table if not exists public.route_places (
  id           uuid primary key default gen_random_uuid(),
  route_id     uuid not null references public.routes (id) on delete cascade,
  place_id     uuid not null references public.places (id) on delete cascade,
  day_index    int not null check (day_index >= 0),
  order_index  int not null check (order_index >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists route_places_route_id_idx
  on public.route_places (route_id, day_index, order_index);
create index if not exists route_places_place_id_idx on public.route_places (place_id);

comment on table  public.route_places             is '路线-地点关联，一天最多 MAX_PLACES_PER_DAY(B01) 个点由应用层校验';
comment on column public.route_places.day_index   is '第几天，0 基（前端数组下标）';
comment on column public.route_places.order_index is '当天第几站，0 基（前端数组下标）';
