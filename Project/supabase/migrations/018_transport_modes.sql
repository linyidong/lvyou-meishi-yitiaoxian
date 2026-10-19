-- 018_transport_modes.sql
-- 用途：把 routes.transport 的取值从 walk / bike 扩为 walk / bike / transit / drive（「市内交通」4 种方式）。
--
-- 背景：U05 新建路线 / U07 勾选地点 / U08 调整路线的「市内交通」由 2 种方式扩为 4 种
--       （步行 / 骑行 / 公交地铁 / 驾车），取值与结果页 U09 的 NAV_MODE 完全一致。
--       原 check 约束（004_create_routes.sql 内联）只允许 walk / bike，
--       不改会导致选择「公交地铁 / 驾车」创建路线时被库拒绝。
-- 幂等性：可重复执行（drop if exists → add）。
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

alter table public.routes drop constraint if exists routes_transport_check;
alter table public.routes
  add constraint routes_transport_check
  check (transport in ('walk', 'bike', 'transit', 'drive'));

comment on column public.routes.transport is 'walk / bike / transit / drive，取值见 config/enums.ts TRANSPORT（E03/E04）';
