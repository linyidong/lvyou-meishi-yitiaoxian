-- 028_route_import_source.sql
-- T-041：分享导入（会员功能）——给路线加"来源分享"标记
-- 用途：/routes 页面把「从会员分享导入的路线」单独分组展示；null 表示自己创建。
-- 纯新增列、可空、默认 null，不影响现有行；可重复执行。
alter table public.routes add column if not exists imported_from text;

comment on column public.routes.imported_from is
  '来源分享 token（null=自己创建；非空=由该分享导入）。见 docs/decisions.md D-17';

-- 回滚：
-- alter table public.routes drop column if exists imported_from;
