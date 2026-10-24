/**
 * 路由常量（R01-R17）
 * 组件内跳转必须引用本文件，禁止写死 '/city' 这类字符串。
 * 改路由需同时改 middleware.ts。
 */
export const ROUTES = {
  /** R01 首页（公开） */
  HOME: '/',
  /** R02 登录 / 注册 */
  LOGIN: '/login',
  /** R03 我的路线 */
  MY_ROUTES: '/routes',
  /** R04 选择城市 */
  CITY: '/city',
  /** R05 新建路线 */
  ROUTE_NEW: '/route/new',
  /** R06 添加地点 */
  ROUTE_ADD: (id: string) => `/route/${id}/add`,
  /** R07 地点勾选 */
  ROUTE_PLACES: (id: string) => `/route/${id}/places`,
  /** R08 路线编辑 */
  ROUTE_EDIT: (id: string) => `/route/${id}/edit`,
  /** R09 路线结果 */
  ROUTE_DETAIL: (id: string) => `/route/${id}`,
  /** R10 个人中心 */
  PROFILE: '/profile',
  /** R11 管理员登录 */
  ADMIN_LOGIN: '/admin/login',
  /** R12 管理员概览 */
  ADMIN_HOME: '/admin',
  /** R13 管理员用户列表 */
  ADMIN_USERS: '/admin/users',
  /** R14 管理员在线用户 */
  ADMIN_ONLINE: '/admin/online',
  /** R15 管理员地点列表 */
  ADMIN_PLACES: '/admin/places',
  /** R16 管理员路线列表 */
  ADMIN_ROUTES: '/admin/routes',
  /** R17 管理员导入记录 */
  ADMIN_IMPORTS: '/admin/imports',
  /** R18 我的收藏地点（U11，本期新增） */
  COLLECTED: '/collected',
  /** R19 管理员会员订单（阶段 3，A08） */
  ADMIN_ORDERS: '/admin/orders',
  /** R20 公开分享页（阶段 3，按分享令牌访问） */
  SHARE: (token: string) => `/share/${token}`,
  /** R21 游客试用 · 设置路线（免登录） */
  TRY_NEW: '/try/new',
  /** R22 游客试用 · 挑选地点（免登录） */
  TRY_PICK: '/try/pick',
  /** R23 游客试用 · 路线结果（免登录） */
  TRY_RESULT: '/try/result',
  /** R24 管理员全局设置（T-049） */
  ADMIN_SETTINGS: '/admin/settings',
  /** R25 管理员技术栈说明（T-049） */
  ADMIN_TECH_STACK: '/admin/tech-stack',
} as const;

/** 需登录才能访问的前缀（middleware.ts 使用） */
export const PROTECTED_ROUTES = [ROUTES.MY_ROUTES, '/route', ROUTES.PROFILE, ROUTES.COLLECTED];

/**
 * 额外免登录前缀（middleware.ts 放行）：游客试用链路 /try/*，
 * 未登录也能走完「设置路线 → 挑选地点 → 查看结果」，只有保存路线时才需要登录。
 */
export const GUEST_TRY_ROUTES = [ROUTES.TRY_NEW, ROUTES.TRY_PICK, ROUTES.TRY_RESULT];

/** 需登录且 role=admin 才能访问的前缀（middleware.ts 使用） */
export const ADMIN_ROUTES = [
  ROUTES.ADMIN_HOME,
  ROUTES.ADMIN_USERS,
  ROUTES.ADMIN_ONLINE,
  ROUTES.ADMIN_PLACES,
  ROUTES.ADMIN_ROUTES,
  ROUTES.ADMIN_IMPORTS,
  ROUTES.ADMIN_ORDERS,
  ROUTES.ADMIN_SETTINGS,
  ROUTES.ADMIN_TECH_STACK,
];
