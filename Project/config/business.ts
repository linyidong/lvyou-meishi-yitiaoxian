/**
 * 业务规则常量（B01-B12、A01-A06、C07）
 * 组件内禁止写死 10 / 5 / 60 这类数值，一律引用本文件。
 */
export const BUSINESS = {
  /** B01 单日最多地点数（与 U07 原型一致，也是会员档上限；免费档上限见 P03 FREE_MAX_PLACES_PER_DAY） */
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
  /**
   * B10 是否启用真实支付（阶段 3 开启）。
   * true = 走「收款码 + 付款备注 → 管理员人工核销」的付费开通流程（POST /api/member/orders）；
   * false = 保留旧的模拟自助升级（POST /api/member 直接置会员）。
   */
  ENABLE_REAL_PAYMENT: true,
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
  /** B26 驾车速度 km/h（U09 导航方式切换，市内平均车速，算不出路线时估算用） */
  DRIVE_SPEED_KMH: 25,
  /** B27 公交地铁速度 km/h（U09 导航方式切换，含等车与换乘的等效速度） */
  TRANSIT_SPEED_KMH: 18,

  /**
   * 游客试用（免登录）链路配额。仅作用于 /api/try/* 两个免登录接口：
   * 用内存 Map 按「客户端 IP + 接口 + 日期」计数，超限返回 429（见 lib/guest-rate-limit.ts）。
   */
  /** T01 免登录接口每 IP、每个接口每天最多调用次数 */
  GUEST_TRY_RATE_LIMIT_PER_DAY: 3,
  /** T02 进入试用结果页所需的最少地点数 */
  GUEST_TRY_MIN_PLACES: 2,
  /** T03 试用路线单次最多挑选地点数（与 P03 免费档一致：游客试用草稿要能原样转正，不能超过免费档单日上限） */
  GUEST_TRY_MAX_PLACES: 6,

  /**
   * Q01 高德调用配额（次/月）：高德个人认证开发者基础 LBS 服务 15 万次/月，这是「每个 Key（每个高德账号）」的硬顶。
   * 支持配置多个账号的 Key 叠加使用（.env.local：AMAP_WEB_SERVICE_KEY / _2 / _3），
   * 合计配额 = 本值 × 已配置 Key 数；用量统计见 public.amap_usage（含 key_slot 维度），看板见 A02「本月高德用量」卡片。
   * 熔断降级（Q04）只在「所有 Key 都用满」时才触发。
   */
  AMAP_MONTHLY_QUOTA: 150000,
  /** Q02 高德距离 / 算路结果落库缓存 TTL（天）：超过视为未命中，重新请求并覆盖 */
  AMAP_CACHE_TTL_DAYS: 30,
  /**
   * 服务端调用 Supabase 的超时（毫秒）。supabase-js 默认**没有超时**，
   * 一旦 Supabase 服务端假死（实测过：TCP 3ms 能握手、HTTP 一个字节都不回），
   * 所有请求会无限挂起 —— 表现为「登录转圈不动」「页面白屏」，且没有任何错误提示，
   * 排查时极易误判成密码错或前端故障。加超时后同类故障会秒级暴露为明确错误。
   */
  SUPABASE_TIMEOUT_MS: 5000,
  /** Q03 高德用量黄色预警阈值（占月配额百分比），看板据此提示 */
  AMAP_QUOTA_WARN_PERCENT: 80,
  /** Q04 高德用量红色预警 / 熔断降级阈值（占月配额百分比），达到后进入降级模式 */
  AMAP_QUOTA_CRITICAL_PERCENT: 95,

  /**
   * 阶段 2 会员分层配额（游客 = 非会员，含未登录访客与免费注册用户）。
   * 所有阈值集中此处，服务端用 lib/member-quota.ts 读取，前端只做提示。
   */

  /**
   * P01/P02 「生成路线」限额按身份分周期：免费按天（每天 1 条）、会员按月（每月 10 条）。
   * 周期口径见 lib/member-quota.ts 的 TierLimits.routeLimitPeriod，
   * 计数分别落在 user_daily_usage 的 generate_route（按天）与 generate_route_month（按月）两个桶。
   */
  /** P01 免费用户每天「生成路线」次数上限 */
  FREE_DAILY_ROUTE_LIMIT: 1,
  /** P02 会员每月「生成路线」次数上限 */
  MEMBER_MONTHLY_ROUTE_LIMIT: 10,
  /** P03 免费用户单日地点数上限（免费版只能单日行程） */
  FREE_MAX_PLACES_PER_DAY: 6,
  /** P04 会员单日地点数上限（与 B01 MAX_PLACES_PER_DAY 一致） */
  MEMBER_MAX_PLACES_PER_DAY: 12,
  /** P05 免费用户行程天数上限（单日；多日需消耗永久 1 次试用额度） */
  FREE_MAX_DAYS: 1,
  /** P06 会员行程天数上限（与 B02 MAX_DAYS 一致） */
  MEMBER_MAX_DAYS: 7,
  /** P07 免费用户每天 AI 提取地点次数上限 */
  FREE_AI_EXTRACT_DAILY_LIMIT: 10,
  /** P08 会员每天 AI 提取地点次数上限 */
  MEMBER_AI_EXTRACT_DAILY_LIMIT: 20,

  /**
   * 阶段 3 会员付费开通（收款码人工核销）。
   * 金额一律以此处为准，服务端按 key 取价，绝不信任前端传入的金额。
   * 收银台只上架月卡；E25 year（年卡）与 forever（永久）均已下架，
   * 保留在 config/enums.ts 仅用于历史订单的套餐名称展示。
   */
  MEMBER_PLANS: [{ key: 'month', priceCents: 1500, days: 30 }],
  /**
   * 收款码通道（图片放 public 目录，管理员自行替换对应文件）。
   * 数组第一项为收银台默认选中项；key 与 member_orders.pay_channel 的 check 约束逐字一致。
   */
  MEMBER_PAY_CHANNELS: [
    { key: 'wechat', label: '微信支付', image: '/pay-qr-wechat.png' },
    { key: 'alipay', label: '支付宝', image: '/pay-qr-alipay.png' },
  ],
  /** 同一用户「待核销」订单上限，达到后不允许再提交 */
  MAX_PENDING_ORDERS: 2,
  /** 管理端订单列表单次读取上限 */
  ADMIN_ORDER_LIMIT: 200,

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
