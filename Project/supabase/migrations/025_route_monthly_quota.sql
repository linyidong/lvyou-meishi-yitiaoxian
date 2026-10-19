-- 025_route_monthly_quota.sql
-- 阶段 2 配额口径调整：「生成路线」限额按身份分周期 —— 免费按天（每天 1 条）、会员按月（每月 10 条）。
--
-- 复用迁移 020 的 public.user_daily_usage（表结构与两个函数都不变）：
--   * 按天桶继续用 kind = 'generate_route'，day 存服务器本地日期（YYYY-MM-DD）；
--   * 按月桶新增 kind = 'generate_route_month'，day 复用同一列存当月 1 号（YYYY-MM-01）。
-- 两个桶 kind 不同，主键 (user_id, day, kind) 天然隔离，互不覆盖。
-- 本迁移只放宽 kind 的 check 约束，不需要建表、不需要改函数，可重复执行。
--
-- 对应代码：config/business.ts P01/P02、config/enums.ts USAGE_KIND、
--           lib/member-quota.ts 的 getRouteQuota / consumeRouteQuota。

-- ==================== ① 放宽 kind 的取值约束 ====================
-- 020 里的 check 是建表内联约束，Pg 自动命名为 user_daily_usage_kind_check；
-- 先删再建同名约束，保证本文件重复执行也不会报「约束已存在」。
alter table public.user_daily_usage
  drop constraint if exists user_daily_usage_kind_check;

alter table public.user_daily_usage
  add constraint user_daily_usage_kind_check
  check (kind in ('generate_route', 'generate_route_month', 'ai_extract'));

-- ==================== ② 更新列注释（口径变化） ====================
comment on column public.user_daily_usage.day is
  '计数周期键：按天桶存服务器本地日期（YYYY-MM-DD）「每天」限额按此口径；按月桶存当月 1 号（YYYY-MM-01）「每月」限额按此口径';

comment on column public.user_daily_usage.kind is
  'generate_route=生成路线·免费按天 / generate_route_month=生成路线·会员按月 / ai_extract=AI 提取，取值见 config/enums.ts USAGE_KIND';
