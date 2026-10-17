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
} as const;

export const TRANSPORT_LABEL: Record<(typeof TRANSPORT)[keyof typeof TRANSPORT], string> = {
  [TRANSPORT.WALK]: '步行',
  [TRANSPORT.BIKE]: '骑行',
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

/** E19/E20 会员开通来源（U10 / A03） */
export const MEMBER_SOURCE = {
  SELF: 'self',
  ADMIN: 'admin',
} as const;

export const MEMBER_SOURCE_LABEL: Record<(typeof MEMBER_SOURCE)[keyof typeof MEMBER_SOURCE], string> =
  {
    [MEMBER_SOURCE.SELF]: '用户自助升级',
    [MEMBER_SOURCE.ADMIN]: '管理员开通',
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
