-- 035_feedback_hidden.sql
-- T-100 意见箱支持后台清理：软删除（hidden_by_admin），
-- 后台列表不再显示，但用户自己的「我最近提交」保持可见。
alter table public.feedback
  add column if not exists hidden_by_admin boolean not null default false;

create index if not exists feedback_hidden_idx
  on public.feedback (hidden_by_admin, created_at desc);

-- 回滚：
-- drop index if exists feedback_hidden_idx;
-- alter table public.feedback drop column if exists hidden_by_admin;
