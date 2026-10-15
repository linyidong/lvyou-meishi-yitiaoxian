/**
 * 业务规则常量（B01-B12、A01-A06、C07）
 * 组件内禁止写死 10 / 5 / 60 这类数值，一律引用本文件。
 */
export const BUSINESS = {
  /** B01 单日最多地点数（含起点终点） */
  MAX_PLACES_PER_DAY: 10,
  /** B02 多日最多天数 */
  MAX_DAYS: 7,
  /** B03 AI 单次最多提取地点数 */
  MAX_AI_EXTRACT: 20,
  /** B04 在线判定时间（分钟），对应 users.last_seen_at 阈值 */
  ONLINE_THRESHOLD_MINUTES: 5,
  /** B05 心跳上报间隔（秒） */
  HEARTBEAT_INTERVAL_SECONDS: 60,
  /** B06 管理员列表每页条数 */
  ADMIN_PAGE_SIZE: 20,
  /** B07 用户列表每页条数 */
  USER_PAGE_SIZE: 20,
  /** B08 是否允许未登录试用 */
  ALLOW_GUEST_TRIAL: true,
  /** B09 是否启用付费按钮（第一版只埋点） */
  ENABLE_UPGRADE_BUTTON: true,
  /** B10 是否启用真实支付（第一版关闭） */
  ENABLE_REAL_PAYMENT: false,
  /** B11 是否启用公开路线（第一版关闭） */
  ENABLE_PUBLIC_ROUTES: false,
  /** B12 是否启用分享链接（第一版关闭） */
  ENABLE_SHARE_LINK: false,

  /** C07 管理员邮箱（数据库 users.role 已设为 admin） */
  ADMIN_EMAIL: '1035940028@qq.com',

  /** A01 管理员可查看在线信息 */
  ADMIN_CAN_VIEW_ONLINE: true,
  /** A02 管理员可编辑数据（第一版只读） */
  ADMIN_CAN_EDIT: false,
  /** A03 管理员可删除数据（第一版只读） */
  ADMIN_CAN_DELETE: false,
  /** A04 管理员可踢出用户（第一版不做） */
  ADMIN_CAN_KICK: false,
  /** A05 在线列表自动刷新（第一版手动） */
  ADMIN_ONLINE_AUTO_REFRESH: false,
  /** A06 在线列表自动刷新间隔（秒，若启用） */
  ADMIN_ONLINE_REFRESH_SECONDS: 30,
} as const;
