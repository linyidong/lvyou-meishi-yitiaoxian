-- 031_usage_kind_ocr.sql
-- T-048：让 user_daily_usage.kind 支持 'ocr'，用于持久化图片识别用量（修复 known-issues A9 的内存计数）。
-- 只改 CHECK 约束，不动任何存量数据；可重复执行。
alter table public.user_daily_usage
  drop constraint if exists user_daily_usage_kind_check;

alter table public.user_daily_usage
  add constraint user_daily_usage_kind_check
  check (kind = any (array['generate_route', 'generate_route_month', 'ai_extract', 'ocr']));

-- 回滚（注意：若已存在 ocr 行，需先删除这些行才能恢复旧约束）：
-- alter table public.user_daily_usage drop constraint user_daily_usage_kind_check;
-- alter table public.user_daily_usage add constraint user_daily_usage_kind_check
--   check (kind = any (array['generate_route','generate_route_month','ai_extract']));
