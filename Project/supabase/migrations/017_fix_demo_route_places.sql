-- 017_fix_demo_route_places.sql
-- 用途：清理 016 因关联缺陷产生的重复站点。
--
-- 背景：016 的 route_places 关联最初只按 places.name 匹配、未限定城市。
--       若同一账号下存在「同名但 city_id 为空」的历史地点（早期手动测试留下的 16 条），
--       同一条示例站点会被配出两行：place_id 不同，而 name / 天 / 序完全相同。
--       结果 4 条示例路线的站点共 40 行（应为 22 行），界面上会出现重复站点。
--       016 的关联条件已同步修正（补上 p.city_id = cd.id），本文件只负责删掉已产生的脏数据。
--
-- 修复范围：仅「4 条成都示例路线」中、指向「该账号下 city_id 为空的历史地点」的 route_places 行。
--           不动用户自己建的其他路线，也不删那些历史地点本身（可去管理端地点列表按需清理）。
-- 幂等性：可重复执行，第二次已无行可删。
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

delete from public.route_places rp
where rp.place_id in (
    select p.id
    from public.places p
    join public.users u on u.id = p.user_id
    where u.email = '1035940028@qq.com'
      and p.city_id is null
  )
  and rp.route_id in (
    select r.id
    from public.routes r
    join public.users u on u.id = r.user_id
    where u.email = '1035940028@qq.com'
      and r.title in (
        '成都 · 吃喝一条线',
        '成都 · 老城区半日骑行',
        '周末带娃逛成都',
        '成都慢生活'
      )
  );

-- 执行后自检：以下查询应返回 22（4 条示例路线的站点总数）。
--   select count(*)
--     from public.route_places rp
--     join public.routes r on r.id = rp.route_id
--    where r.user_id = (select id from public.users where email = '1035940028@qq.com')
--      and r.title in ('成都 · 吃喝一条线', '成都 · 老城区半日骑行', '周末带娃逛成都', '成都慢生活');
