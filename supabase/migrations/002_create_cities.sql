-- 002_create_cities.sql
-- cities：城市字典，所有人可读；数据由 011_seed_cities.sql 初始化。

create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  adcode      text not null,
  created_at  timestamptz not null default now()
);

-- 城市名唯一：便于按名称查询，且让初始化脚本可重复执行（on conflict (name)）
create unique index if not exists cities_name_key on public.cities (name);
-- 高德城市编码不应重复
create unique index if not exists cities_adcode_key on public.cities (adcode);

comment on table  public.cities        is '城市字典（CT01-CT03），name 与 config/cities.ts 保持一致（SY07）';
comment on column public.cities.adcode is '高德城市编码（adcode），如 厦门=350200';
