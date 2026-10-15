-- 006_create_imports.sql
-- imports：文案导入记录（小红书 / 抖音 / 手动）。

create table if not exists public.imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  raw_text    text not null,
  source      text not null check (source in ('xiaohongshu', 'douyin', 'manual')),
  status      text not null check (status in ('success', 'failed')),
  created_at  timestamptz not null default now()
);

create index if not exists imports_user_id_idx on public.imports (user_id);

comment on table  public.imports        is '文案导入记录，供管理员页 /admin/imports 查询';
comment on column public.imports.source is 'xiaohongshu / douyin / manual，见 config/enums.ts IMPORT_SOURCE（E05-E07）';
comment on column public.imports.status is 'success / failed，见 config/enums.ts IMPORT_STATUS（E08/E09）';
