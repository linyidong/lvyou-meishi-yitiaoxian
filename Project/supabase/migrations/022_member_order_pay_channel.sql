-- 022_member_order_pay_channel.sql
-- 阶段 3 补充：会员付费订单记录付款通道（微信 / 支付宝收款码）。
-- 收银台新增支付宝收款码后，订单必须写明用户扫的是哪个通道，管理员核销时才知道去哪个收款账户对账。
-- 全部语句幂等，可重复执行（add column if not exists / drop constraint if exists 后再 add）。
-- 执行方式：手动，在自建 Supabase 的 Studio → SQL Editor 中整段粘贴后点击 Run。

-- 1) 新增 member_orders.pay_channel（默认 wechat：022 之前只有微信收款码一个通道）
alter table public.member_orders
  add column if not exists pay_channel text not null default 'wechat';

-- 2) 取值约束（与 config/enums.ts PAY_CHANNEL 逐字一致）
alter table public.member_orders drop constraint if exists member_orders_pay_channel_check;
alter table public.member_orders
  add constraint member_orders_pay_channel_check
  check (pay_channel in ('wechat', 'alipay'));

comment on column public.member_orders.pay_channel is '付款通道：wechat=微信支付 / alipay=支付宝，见 config/enums.ts PAY_CHANNEL 与 config/business.ts MEMBER_PAY_CHANNELS；由服务端按前端所选通道写入';
