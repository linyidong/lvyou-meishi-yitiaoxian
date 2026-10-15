import { MEMBER_ACTION, MEMBER_SOURCE, USER_ROLE } from '@/config/enums';

/** 用户角色（E10/E11） */
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/** 会员开通来源（E19/E20） */
export type MemberSource = (typeof MEMBER_SOURCE)[keyof typeof MEMBER_SOURCE];

/** 会员操作动作（E23/E24） */
export type MemberAction = (typeof MEMBER_ACTION)[keyof typeof MEMBER_ACTION];

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
  /** 开通来源：用户自助升级 / 管理员开通 */
  member_source: MemberSource | null;
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
