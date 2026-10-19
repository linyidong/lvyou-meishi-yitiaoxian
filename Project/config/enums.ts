/**
 * 枚举常量（E01-E22）
 * 库内存英文枚举值，界面展示一律走 *_LABEL 映射（SY05）。
 * 本文件所有取值必须与 supabase/migrations 同名 check 约束逐字一致，改一处必须同时改另一处。
 */
/** E01/E02 地点类型 */
export const PLACE_TYPE = {
  ATTRACTION: 'attraction',
  FOOD: 'food',
} as const;

export const PLACE_TYPE_LABEL: Record<(typeof PLACE_TYPE)[keyof typeof PLACE_TYPE], string> = {
  [PLACE_TYPE.ATTRACTION]: '景点',
  [PLACE_TYPE.FOOD]: '美食',
};

/** E03/E04 交通方式（市内） */
export const TRANSPORT = {
  WALK: 'walk',
  BIKE: 'bike',
  TRANSIT: 'transit',
  DRIVE: 'drive',
} as const;

export const TRANSPORT_LABEL: Record<(typeof TRANSPORT)[keyof typeof TRANSPORT], string> = {
  [TRANSPORT.WALK]: '步行',
  [TRANSPORT.BIKE]: '骑行',
  [TRANSPORT.TRANSIT]: '公交地铁',
  [TRANSPORT.DRIVE]: '驾车',
};

/**
 * E03b 导航方式（U09 路线结果页视图层）。
 * 现在 TRANSPORT 与 NAV_MODE 取值完全一致（walk / bike / transit / drive），
 * 区别只在用途：TRANSPORT 用于入库 routes.transport（见 004_create_routes.sql 的 check 约束），
 * NAV_MODE 只用于 U09 查看路线时切换算路与排序，不写库。
 */
export const NAV_MODE = {
  WALK: 'walk',
  BIKE: 'bike',
  TRANSIT: 'transit',
  DRIVE: 'drive',
} as const;

export const NAV_MODE_VALUES = [
  NAV_MODE.WALK,
  NAV_MODE.BIKE,
  NAV_MODE.TRANSIT,
  NAV_MODE.DRIVE,
] as const;

export type NavMode = (typeof NAV_MODE)[keyof typeof NAV_MODE];

export const NAV_MODE_LABEL: Record<NavMode, string> = {
  [NAV_MODE.WALK]: '步行',
  [NAV_MODE.BIKE]: '骑行',
  [NAV_MODE.TRANSIT]: '公交地铁',
  [NAV_MODE.DRIVE]: '驾车',
};

/** E05-E07 导入来源 */
export const IMPORT_SOURCE = {
  XIAOHONGSHU: 'xiaohongshu',
  DOUYIN: 'douyin',
  MANUAL: 'manual',
} as const;

export const IMPORT_SOURCE_LABEL: Record<(typeof IMPORT_SOURCE)[keyof typeof IMPORT_SOURCE], string> =
  {
    [IMPORT_SOURCE.XIAOHONGSHU]: '小红书',
    [IMPORT_SOURCE.DOUYIN]: '抖音',
    [IMPORT_SOURCE.MANUAL]: '手动',
  };

/** E08/E09 导入状态（四态，A07 导入记录使用） */
export const IMPORT_STATUS = {
  SUCCESS: 'success',
  NEED_TEXT: 'need_text',
  UNRECOGNIZED: 'unrecognized',
  FAILED: 'failed',
} as const;

export const IMPORT_STATUS_LABEL: Record<(typeof IMPORT_STATUS)[keyof typeof IMPORT_STATUS], string> = {
  [IMPORT_STATUS.SUCCESS]: '提取成功',
  [IMPORT_STATUS.NEED_TEXT]: '需补文案',
  [IMPORT_STATUS.UNRECOGNIZED]: '未识别',
  [IMPORT_STATUS.FAILED]: '失败',
};

/** E10/E11 用户角色 */
export const USER_ROLE = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export const USER_ROLE_LABEL: Record<(typeof USER_ROLE)[keyof typeof USER_ROLE], string> = {
  [USER_ROLE.USER]: '普通用户',
  [USER_ROLE.ADMIN]: '管理员',
};

/** E12-E14 埋点事件名（七项） */
export const EVENT_NAME = {
  ADD_PLACE: 'add_place',
  GENERATE_ROUTE: 'generate_route',
  CLICK_UPGRADE: 'click_upgrade',
  SIGN_UP: 'sign_up',
  COLLECT_ADD_ROUTE: 'collect_add_route',
  COLLECT_REMOVE: 'collect_remove',
  MEMBER_CHANGE: 'member_change',
} as const;

/**
 * 阶段 2 会员分层：服务端限额校验返回的错误码。
 * 前端据此区分「次数用完 / 需要会员才能多日 / 地点超限」，展示文案一律取 config/messages.ts。
 */
export const QUOTA_ERROR = {
  /** 当天「生成路线」次数已用完（免费用户按天） */
  ROUTE_DAILY_LIMIT: 'route_daily_limit',
  /** 当月「生成路线」次数已用完（会员按月） */
  ROUTE_MONTHLY_LIMIT: 'route_monthly_limit',
  /** 多日行程仅会员可用（免费用户永久 1 次试用额度已用） */
  MULTI_DAY_MEMBER_ONLY: 'multi_day_member_only',
  /** 单日地点数超当前角色上限 */
  PLACES_PER_DAY_LIMIT: 'places_per_day_limit',
  /** 当天 AI 提取次数已用完 */
  AI_EXTRACT_DAILY_LIMIT: 'ai_extract_daily_limit',
} as const;

export type QuotaError = (typeof QUOTA_ERROR)[keyof typeof QUOTA_ERROR];

/**
 * public.user_daily_usage.kind 取值（与迁移 020 / 025 的 check 约束逐字一致）。
 * 记录服务端每日本人的实际动作次数，作为限额判定的数据源。
 */
export const USAGE_KIND = {
  /** 生成路线次数（免费用户按天：POST /api/routes、POST /api/try/promote 建路线时累加） */
  GENERATE_ROUTE: 'generate_route',
  /**
   * 生成路线次数（会员按月）。
   * 复用同一张表的 day 列存当月 1 号，与按天桶以 kind 区分，互不干扰。
   */
  GENERATE_ROUTE_MONTH: 'generate_route_month',
  /** AI 提取地点次数（POST /api/ai/extract 成功时累加） */
  AI_EXTRACT: 'ai_extract',
} as const;

export type UsageKind = (typeof USAGE_KIND)[keyof typeof USAGE_KIND];

/** E15/E16 城际交通·去程（U05 / U08 出行设置） */
export const INTERCITY_MODE = {
  HSR: 'hsr',
  PLANE: 'plane',
  DRIVE: 'drive',
  COACH: 'coach',
  SLEEPER: 'sleeper',
  NONE: 'none',
} as const;

export const INTERCITY_MODE_LABEL: Record<
  (typeof INTERCITY_MODE)[keyof typeof INTERCITY_MODE],
  string
> = {
  [INTERCITY_MODE.HSR]: '高铁 / 动车',
  [INTERCITY_MODE.PLANE]: '飞机',
  [INTERCITY_MODE.DRIVE]: '自驾',
  [INTERCITY_MODE.COACH]: '长途大巴',
  [INTERCITY_MODE.SLEEPER]: '火车卧铺',
  [INTERCITY_MODE.NONE]: '暂不设置',
};

/** E17/E18 住宿类型（U05 / U08 出行设置） */
export const LODGING_TYPE = {
  HOTEL: 'hotel',
  HOMESTAY: 'homestay',
  HOSTEL: 'hostel',
  RELATIVE: 'relative',
  OTHER: 'other',
} as const;

export const LODGING_TYPE_LABEL: Record<(typeof LODGING_TYPE)[keyof typeof LODGING_TYPE], string> = {
  [LODGING_TYPE.HOTEL]: '酒店',
  [LODGING_TYPE.HOMESTAY]: '民宿',
  [LODGING_TYPE.HOSTEL]: '青旅',
  [LODGING_TYPE.RELATIVE]: '亲友家',
  [LODGING_TYPE.OTHER]: '其他',
};

/** E19/E20 会员开通来源（U10 / A03 / 阶段 3 付费开通） */
export const MEMBER_SOURCE = {
  SELF: 'self',
  ADMIN: 'admin',
  PAID: 'paid',
} as const;

export const MEMBER_SOURCE_LABEL: Record<(typeof MEMBER_SOURCE)[keyof typeof MEMBER_SOURCE], string> =
  {
    [MEMBER_SOURCE.SELF]: '用户自助升级',
    [MEMBER_SOURCE.ADMIN]: '管理员开通',
    [MEMBER_SOURCE.PAID]: '付费开通',
  };

/**
 * E25 会员套餐（阶段 3 付费开通）。
 * 与迁移 021 的 member_orders_plan_check 逐字一致：month / year / forever。
 * 注意：收银台只上架 month（可选套餐见 config/business.ts MEMBER_PLANS），
 * year / forever 已下架，这里保留取值仅用于兼容历史订单的套餐名称展示。
 */
export const MEMBER_PLAN = {
  MONTH: 'month',
  YEAR: 'year',
  FOREVER: 'forever',
} as const;

export const MEMBER_PLAN_LABEL: Record<(typeof MEMBER_PLAN)[keyof typeof MEMBER_PLAN], string> = {
  [MEMBER_PLAN.MONTH]: '月卡',
  [MEMBER_PLAN.YEAR]: '年卡',
  [MEMBER_PLAN.FOREVER]: '永久会员',
};

/**
 * E27 收款码付款通道（阶段 3 收银台）。
 * 与迁移 022 的 member_orders_pay_channel_check 逐字一致：wechat / alipay。
 * 可选通道与图片路径见 config/business.ts MEMBER_PAY_CHANNELS。
 */
export const PAY_CHANNEL = {
  WECHAT: 'wechat',
  ALIPAY: 'alipay',
} as const;

export const PAY_CHANNEL_LABEL: Record<(typeof PAY_CHANNEL)[keyof typeof PAY_CHANNEL], string> = {
  [PAY_CHANNEL.WECHAT]: '微信支付',
  [PAY_CHANNEL.ALIPAY]: '支付宝',
};

/**
 * E26 会员订单状态（阶段 3 收款码人工核销）。
 * 与迁移 021 的 member_orders_status_check 逐字一致：pending / approved / rejected。
 */
export const ORDER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const ORDER_STATUS_LABEL: Record<(typeof ORDER_STATUS)[keyof typeof ORDER_STATUS], string> = {
  [ORDER_STATUS.PENDING]: '待核销',
  [ORDER_STATUS.APPROVED]: '已开通',
  [ORDER_STATUS.REJECTED]: '已驳回',
};

/** E21/E22 地点坐标匹配状态（A05 地点列表） */
export const GEO_STATUS = {
  MATCHED: 'matched',
  PENDING: 'pending',
  UNMATCHED: 'unmatched',
} as const;

export const GEO_STATUS_LABEL: Record<(typeof GEO_STATUS)[keyof typeof GEO_STATUS], string> = {
  [GEO_STATUS.MATCHED]: '已匹配',
  [GEO_STATUS.PENDING]: '待确认',
  [GEO_STATUS.UNMATCHED]: '未匹配',
};

/** E23/E24 会员操作动作（member_logs.action，A03 会员留痕） */
export const MEMBER_ACTION = {
  GRANT: 'grant',
  REVOKE: 'revoke',
} as const;

export const MEMBER_ACTION_LABEL: Record<
  (typeof MEMBER_ACTION)[keyof typeof MEMBER_ACTION],
  string
> = {
  [MEMBER_ACTION.GRANT]: '开通会员',
  [MEMBER_ACTION.REVOKE]: '取消会员',
};
