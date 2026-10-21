-- 026_member_expire_cron.sql
-- T-004：会员到期自动失效（不依赖用户访问）
-- 机制：pg_cron 每日 03:05 把「已过 member_until」的付费会员置为非会员。
-- 边界：只处理 member = true 且 member_until 非空且已过期者；
--       member_until 为 NULL 的永久会员与管理员（role=admin）不受影响。
-- 回滚：select cron.unschedule('expire-members'); drop extension if exists pg_cron;

create extension if not exists pg_cron;

-- 同名任务重复执行时 pg_cron 会覆盖更新，保证幂等
select cron.schedule(
  'expire-members',
  '5 3 * * *',
  $$update users set member = false
      where member = true
        and member_until is not null
        and member_until < now()$$
);
