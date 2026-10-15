/**
 * 枚举常量（E01-E14）
 * 库内存英文枚举值，界面展示一律走 *_LABEL 映射（SY05）。
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

/** E03/E04 交通方式 */
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

/** E08/E09 导入状态 */
export const IMPORT_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export const IMPORT_STATUS_LABEL: Record<(typeof IMPORT_STATUS)[keyof typeof IMPORT_STATUS], string> = {
  [IMPORT_STATUS.SUCCESS]: '成功',
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

/** E12-E14 埋点事件名 */
export const EVENT_NAME = {
  ADD_PLACE: 'add_place',
  GENERATE_ROUTE: 'generate_route',
  CLICK_UPGRADE: 'click_upgrade',
} as const;
