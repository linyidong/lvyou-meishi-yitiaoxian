-- 012_places_collection.sql
-- U11 收藏地点：places 增加「收藏标记 / 来源 / 坐标匹配」三列。
--
-- 设计说明（已与产品确认，不新建独立收藏表）：
--   places 本身就是「按用户隔离的私人地点库」（user_id 非空 + RLS auth.uid() = user_id），
--   收藏语义 = 该行存在；「出行时从收藏同步」= 从 places 挑点写进 route_places（只引用 place_id）。
--   因此加入路线不会改动 places，收藏与路线天然解耦。
--   唯一需要的是「从收藏移除、但路线里仍要保留这个点」：
--   route_places.place_id 是 on delete cascade，直接删 places 行会连带删掉路线上的站点，
--   所以用软标记 is_collected = false 表达「已从收藏移除」，收藏页只查 is_collected = true。

alter table public.places
  add column if not exists is_collected boolean not null default true,
  add column if not exists source       text,
  add column if not exists geo_status   text not null default 'matched';

-- 来源枚举与 imports.source 保持一致（config/enums.ts IMPORT_SOURCE，E05-E07）
alter table public.places drop constraint if exists places_source_check;
alter table public.places
  add constraint places_source_check
  check (source is null or source in ('xiaohongshu', 'douyin', 'manual'));

-- 坐标匹配状态，供管理端 A05 地点列表展示（已匹配 / 待确认 / 未匹配）
alter table public.places drop constraint if exists places_geo_status_check;
alter table public.places
  add constraint places_geo_status_check
  check (geo_status in ('matched', 'pending', 'unmatched'));

-- 收藏页按「本人的未移除收藏」过滤，走联合索引
create index if not exists places_user_collected_idx
  on public.places (user_id, is_collected);

comment on column public.places.is_collected is '是否在「我的收藏」中；false = 已从收藏移除（保留行以支撑 route_places 引用）';
comment on column public.places.source       is '地点来源：xiaohongshu / douyin / manual，见 config/enums.ts IMPORT_SOURCE（E05-E07）';
comment on column public.places.geo_status   is '坐标匹配状态：matched / pending / unmatched，供 A05 地点列表展示';
