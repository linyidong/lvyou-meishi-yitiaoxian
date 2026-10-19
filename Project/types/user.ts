import {
  MEMBER_ACTION,
  MEMBER_PLAN,
  MEMBER_SOURCE,
  ORDER_STATUS,
  PAY_CHANNEL,
  USER_ROLE,
} from '@/config/enums';

/** 用户角色（E10/E11） */
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/** 会员开通来源（E19/E20） */
export type MemberSource = (typeof MEMBER_SOURCE)[keyof typeof MEMBER_SOURCE];

/** 会员操作动作（E23/E24） */
export type MemberAction = (typeof MEMBER_ACTION)[keyof typeof MEMBER_ACTION];

/** 会员套餐（E25） */
export type MemberPlan = (typeof MEMBER_PLAN)[keyof typeof MEMBER_PLAN];

/** 收款码付款通道（E27） */
export type PayChannel = (typeof PAY_CHANNEL)[keyof typeof PAY_CHANNEL];

/** 会员订单状态（E26） */
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** public.users 行（id 与 auth.users 一一对应） */
export interface UserRow {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  /** 最后活跃时间，心跳接口更新；在线判定见 BUSINESS.ONLINE_THRESHOLD_MINUTES */
  last_seen_at: string | null;
  /** 当前所在页面，心跳接口更新 */
  current_path: string | null;
  /** 是否会员；第一版为模拟开通（BUSINESS.ENABLE_REAL_PAYMENT = false） */
  member: boolean;
  /** 会员开通时间 */
  member_since: string | null;
  /** 开通来源：用户自助升级 / 管理员开通 / 付费开通 */
  member_source: MemberSource | null;
  /** 会员到期时间；null = 永久会员（阶段 3 付费开通按套餐写入） */
  member_until: string | null;
  created_at: string;
}

/** public.member_logs 行（A03 会员操作留痕） */
export interface MemberLogRow {
  id: string;
  target_user: string;
  action: MemberAction;
  /** 操作人；自助升级时为本人，管理员开通时为管理员 */
  operator_id: string | null;
  source: MemberSource;
  created_at: string;
}

/** public.member_orders 行（阶段 3 会员付费订单，收款码人工核销） */
export interface MemberOrderRow {
  id: string;
  user_id: string;
  plan: MemberPlan;
  /** 金额（分），服务端按套餐写入 */
  amount_cents: number;
  /** 用户填写的付款备注 / 交易单号 */
  pay_note: string | null;
  /** 付款通道（用户扫码用的收款码：微信 / 支付宝），管理员据此对账 */
  pay_channel: PayChannel;
  status: OrderStatus;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** 会员套餐配置行（从 config/business.ts MEMBER_PLANS 派生） */
export interface MemberPlanRow {
  key: MemberPlan;
  priceCents: number;
  days: number | null;
}
