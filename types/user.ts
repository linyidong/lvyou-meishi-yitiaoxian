import { USER_ROLE } from '@/config/enums';

/** 用户角色（E10/E11） */
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

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
  created_at: string;
}
