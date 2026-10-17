-- 016_seed_demo_data.sql
-- 用途：为演示账号补一份可现场演示的「成都」样例数据，让 U09 路线结果 / U03 我的路线 /
--      U11 我的收藏 三个页面立刻有内容可看。数据全部取自墨刀高保真原型
--      （u02-home / u03-my-routes / u06-add / u07-places / u11-collected / a06-admin-routes）里的成都示例。
--
-- 落库内容：
--   ① 22 个成都地点（全部 is_collected = true，即「我的收藏」里能看到 22 条）
--   ② 4 条成都示例路线（含出发城市 / 城际交通 / 住宿等出行设置）
--   ③ 22 条 route_places（4 条路线的按天顺序，与原型顺序一致）
--
-- 执行方式：**手动**。本机没有 psql / supabase CLI / Docker，无法命令行执行，
--          请在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。
--
-- 前置条件：002/003/004/005/011/012/013 迁移已执行；演示账号已注册（public.users 内存在该 email）。
-- 目标账号：由下面的 admin_user CTE 按 email 反查，绝不写死 uuid。
-- 幂等性：所有 insert 都带「同名（同路线同地点）」存在性判断，可重复执行且不会产生重复数据。
--          重复执行时「成都」城市 insert 是 on conflict do nothing，等于空操作。
--
-- 说明：地点坐标（lat / lng）保持为空、geo_status = 'pending'，
--      因为原型示例给的是示意画布坐标，不是真实经纬度；U09 结果页在缺坐标时只渲染示意底图，
--      不画站点连线与站间距离，等用户用高德搜索补齐真实坐标后会自动出现。

-- ============ 0) 城市兜底（成都已在 011_seed_cities.sql 中，这里只兜底） ============
insert into public.cities (name, adcode)
values ('成都', '510100')
on conflict (name) do nothing;

-- ============ 1) 22 个成都地点（收藏） ============
with admin_user as (
  select id from public.users where email = '1035940028@qq.com' limit 1
),
cd as (
  select id from public.cities where name = '成都' limit 1
)
insert into public.places (user_id, city_id, name, address, type, note, source, is_collected, geo_status)
select au.id, cd.id, d.name, d.address, d.type, d.note, d.source, true, 'pending'
from (
  values
    ('宽窄巷子',         '青羊区', 'attraction', '青砖巷子适合拍照，早上人少',          'xiaohongshu'),
    ('人民公园',         '青羊区', 'attraction', '鹤鸣茶社喝盖碗茶，体验采耳',            'xiaohongshu'),
    ('天府广场',         '青羊区', 'attraction', null,                                    null),
    ('春熙路',           '锦江区', 'attraction', null,                                    null),
    ('太古里',           '锦江区', 'attraction', null,                                    null),
    ('武侯祠',           '武侯区', 'attraction', '三国文化打卡，隔壁就是锦里',            'douyin'),
    ('锦里古街',         '武侯区', 'attraction', '夜景好看，小吃偏贵可略过',              'douyin'),
    ('杜甫草堂',         '青羊区', 'attraction', null,                                    null),
    ('九眼桥',           '锦江区', 'attraction', null,                                    null),
    ('东郊记忆',         '成华区', 'attraction', null,                                    null),
    ('文殊院',           '青羊区', 'attraction', null,                                    null),
    ('成都大熊猫基地',   '成华区', 'attraction', null,                                    null),
    ('鹤鸣茶社',         '青羊区', 'food',       null,                                    null),
    ('陈麻婆豆腐',       '青羊区', 'food',       '招牌麻婆豆腐，人均 50 左右',            'xiaohongshu'),
    ('钟水饺',           '锦江区', 'food',       '甜辣口红油饺子，小份刚好',              'xiaohongshu'),
    ('龙抄手',           '锦江区', 'food',       null,                                    null),
    ('贺记蛋烘糕',       '武侯区', 'food',       '路边摊小吃，排队约 10 分钟',            'manual'),
    ('蜀九香火锅',       '锦江区', 'food',       '本地人常去的牛油火锅，记得提前取号',    'douyin'),
    ('王妈手撕烤兔',     '武侯区', 'food',       null,                                    null),
    ('冒椒火辣',         '锦江区', 'food',       null,                                    null),
    ('洞子口张老二凉粉', '金牛区', 'food',       null,                                    null),
    ('马旺子川菜',       '锦江区', 'food',       null,                                    null)
) as d(name, address, type, note, source)
cross join admin_user au
cross join cd
where not exists (
  select 1
  from public.places p
  where p.user_id = au.id
    and p.name = d.name
    and p.city_id is not distinct from cd.id
);

-- ============ 2) 4 条成都示例路线 ============
with admin_user as (
  select id from public.users where email = '1035940028@qq.com' limit 1
),
cd as (
  select id from public.cities where name = '成都' limit 1
)
insert into public.routes (
  user_id, city_id, title, days, transport,
  origin_city, intercity_mode, lodging_type, lodging_area, lodging_name, lodging_nights
)
select au.id, cd.id, d.title, d.days, d.transport,
       d.origin_city, d.intercity_mode, d.lodging_type, d.lodging_area, d.lodging_name, d.lodging_nights
from (
  values
    ('成都 · 吃喝一条线',       2, 'walk', '重庆', 'hsr',   'homestay', '宽窄巷子附近', null, 1),
    ('成都 · 老城区半日骑行',   1, 'bike', '成都', null,    null,       null,           null, null),
    ('周末带娃逛成都',          1, 'bike', '德阳', 'drive', 'relative', null,           null, 1),
    ('成都慢生活',              1, 'walk', '绵阳', null,    null,       null,           null, null)
) as d(title, days, transport, origin_city, intercity_mode, lodging_type, lodging_area, lodging_name, lodging_nights)
cross join admin_user au
cross join cd
where not exists (
  select 1
  from public.routes r
  where r.user_id = au.id
    and r.title = d.title
);

-- ============ 3) 22 条 route_places（按天顺序，与原型一致） ============
with admin_user as (
  select id from public.users where email = '1035940028@qq.com' limit 1
)
insert into public.route_places (route_id, place_id, day_index, order_index)
select r.id, p.id, d.day_index, d.order_index
from (
  values
    -- R1 成都 · 吃喝一条线（2 天）
    ('成都 · 吃喝一条线', 0, 0, '陈麻婆豆腐'),
    ('成都 · 吃喝一条线', 0, 1, '宽窄巷子'),
    ('成都 · 吃喝一条线', 0, 2, '人民公园'),
    ('成都 · 吃喝一条线', 0, 3, '钟水饺'),
    ('成都 · 吃喝一条线', 0, 4, '春熙路'),
    ('成都 · 吃喝一条线', 0, 5, '太古里'),
    ('成都 · 吃喝一条线', 1, 0, '武侯祠'),
    ('成都 · 吃喝一条线', 1, 1, '锦里古街'),
    ('成都 · 吃喝一条线', 1, 2, '贺记蛋烘糕'),
    ('成都 · 吃喝一条线', 1, 3, '九眼桥'),
    ('成都 · 吃喝一条线', 1, 4, '蜀九香火锅'),
    -- R2 成都 · 老城区半日骑行（1 天）
    ('成都 · 老城区半日骑行', 0, 0, '文殊院'),
    ('成都 · 老城区半日骑行', 0, 1, '洞子口张老二凉粉'),
    ('成都 · 老城区半日骑行', 0, 2, '宽窄巷子'),
    ('成都 · 老城区半日骑行', 0, 3, '人民公园'),
    -- R3 周末带娃逛成都（1 天）
    ('周末带娃逛成都', 0, 0, '成都大熊猫基地'),
    ('周末带娃逛成都', 0, 1, '东郊记忆'),
    ('周末带娃逛成都', 0, 2, '钟水饺'),
    ('周末带娃逛成都', 0, 3, '太古里'),
    -- R4 成都慢生活（1 天）
    ('成都慢生活', 0, 0, '人民公园'),
    ('成都慢生活', 0, 1, '鹤鸣茶社'),
    ('成都慢生活', 0, 2, '宽窄巷子')
) as d(route_title, day_index, order_index, place_name)
join admin_user au on true
join public.routes r
  on r.user_id = au.id
 and r.title = d.route_title
join public.places p
  on p.user_id = au.id
 and p.name = d.place_name
where not exists (
  select 1
  from public.route_places rp
  where rp.route_id = r.id
    and rp.place_id = p.id
);

-- ============ 4) 执行后自检（可按需单跑） ============
-- 期望：地点 22 条、路线 4 条、路线站点 22 条。
--   select count(*) from public.places
--    where user_id = (select id from public.users where email = '1035940028@qq.com')
--      and city_id = (select id from public.cities where name = '成都')
--      and is_collected;
--   select count(*) from public.routes
--    where user_id = (select id from public.users where email = '1035940028@qq.com');
--   select count(*) from public.route_places rp
--     join public.routes r on r.id = rp.route_id
--    where r.user_id = (select id from public.users where email = '1035940028@qq.com');
