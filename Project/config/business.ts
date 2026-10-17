/**
 * 业务规则常量（B01-B12、A01-A06、C07）
 * 组件内禁止写死 10 / 5 / 60 这类数值，一律引用本文件。
 */
export const BUSINESS = {
  /** B01 单日最多地点数（与 U07 原型一致） */
  MAX_PLACES_PER_DAY: 12,
  /** B02 多日最多天数（与 U05 原型一致，最少 2 天） */
  MAX_DAYS: 7,
  /** B02a 多日最少天数 */
  MIN_DAYS: 2,
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
  /** B13 单条路线最多地点数（所有天合计，与 U07 原型一致） */
  MAX_PLACES_PER_ROUTE: 30,
  /** B14 路线标题最长字数（U05，不含自动带上的城市名前缀） */
  MAX_ROUTE_TITLE_LENGTH: 30,
  /** B15 住宿区域最长字数（U05 / U08） */
  MAX_LODGING_AREA_LENGTH: 20,
  /** B16 住宿名称最长字数（U05 / U08） */
  MAX_LODGING_NAME_LENGTH: 30,
  /** B17 入住晚数下限（与 013 routes_lodging_nights_check 一致） */
  MIN_LODGING_NIGHTS: 1,
  /** B18 入住晚数上限（与 013 routes_lodging_nights_check 一致） */
  MAX_LODGING_NIGHTS: 30,
  /** B19 管理端列表单次读取上限（A03 / A06，超出的数据待接入分页） */
  ADMIN_LIST_LIMIT: 200,
  /** B20 会员操作留痕展示条数（A03） */
  MEMBER_LOG_LIMIT: 20,
  /** B21 注册密码最短位数（U01 注册，与 Supabase Auth 默认策略一致） */
  MIN_PASSWORD_LENGTH: 8,
  /** B22 首页热门城市展示个数（U02，取自 config/cities.ts HOT_CITIES） */
  HOME_HOT_CITY_LIMIT: 10,
  /** B23 导入文案字数上限（U06 粘贴分享文案，超限提示见 M34） */
  MAX_IMPORT_TEXT_LENGTH: 2000,
  /** B24 步行速度 km/h（U08 市内交通时间估算，与原型 walk 速度一致） */
  WALK_SPEED_KMH: 4.5,
  /** B25 骑行速度 km/h（U08 市内交通时间估算，与原型 bike 速度一致） */
  BIKE_SPEED_KMH: 12,

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
