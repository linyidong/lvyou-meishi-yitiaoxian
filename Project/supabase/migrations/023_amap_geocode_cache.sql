-- 023_amap_geocode_cache.sql
-- 用途：高德文本搜索（v3/place/text）结果落库缓存（阶段：额度降本第 2 步）。
--
-- 背景：place/text 是唯一没有缓存的环节，却是最贵的环节 ——
--       导入文案补地点坐标（app/api/places/route.ts 每个地点 1 次）、
--       住宿坐标解析（route/[id]/page.tsx 与 route/[id]/places/page.tsx 每次进页面都搜 1~2 次）、
--       U06 手动搜索地点（app/api/amap/search/route.ts）全都直接打高德。
--       同一城市 + 同一关键词被反复搜，额度被重复消耗。
--   public.amap_geocode_cache —— 以 (city, keywords) 为键缓存归一化后的 POI 数组，跨进程 / 跨用户共享。
--
-- 幂等性：可重复执行（create ... if not exists）。
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

create table if not exists public.amap_geocode_cache (
  city       text        not null,
  keywords   text        not null,
  results    jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (city, keywords)
);

comment on table public.amap_geocode_cache is
  '高德文本搜索（place/text）结果落库缓存，键为 (city, keywords)，TTL 见 config/business.ts AMAP_CACHE_TTL_DAYS，超过视为未命中并重新请求覆盖；只缓存搜到结果的关键词，空结果不缓存（避免「永久搜不到」）';
comment on column public.amap_geocode_cache.city is '搜索时传入的城市名（place/text 的 city 参数），与关键词共同构成缓存键';
comment on column public.amap_geocode_cache.keywords is '搜索关键词（地点名 / 住宿名 / 住宿区域），与城市共同构成缓存键';
comment on column public.amap_geocode_cache.results is
  '归一化后的 POI 数组（name / address / lat / lng / imageUrl），供 lib/amap.ts searchPlaces 直接复用，命中时不消耗高德额度';
comment on column public.amap_geocode_cache.updated_at is '写入 / 覆盖时间，超过 TTL 视为未命中并重新请求覆盖';

-- 只有 service_role 能读写（service_role 绕过 RLS）；不放开任何 anon / authenticated 策略。
alter table public.amap_geocode_cache enable row level security;
