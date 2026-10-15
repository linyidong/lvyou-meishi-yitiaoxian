/**
 * 提示文案常量（M01-M12）
 * 界面提示禁止写死中文，一律引用 MESSAGES.*。
 */
export const MESSAGES = {
  /** M01 只粘贴了链接 */
  LINK_NEED_TEXT: '请补充分享文案，以便提取地点',
  /** M02 AI 提取失败 */
  AI_FAILED: '提取失败，请手动输入地点名',
  /** M03 高德搜不到该地点 */
  AMAP_NOT_FOUND: '未找到该地点，请手动标点或只保存名称',
  /** M04 地点重复 */
  DUPLICATE_PLACE: '该地点已存在，是否合并或跳过？',
  /** M05 路线生成失败 */
  ROUTE_FAILED: '路线生成失败，请手动调整顺序',
  /** M06 未登录保存路线 */
  LOGIN_REQUIRED: '保存路线需要登录，是否现在登录？',
  /** M07 网络错误 */
  NETWORK_ERROR: '网络异常，请检查网络后重试',
  /** M08 高德额度用完 */
  AMAP_QUOTA_EXCEEDED: '今日地图额度已用完，请稍后再试',
  /** M09 保存成功 */
  SAVE_SUCCESS: '路线已保存',
  /** M10 升级付费提示（第一版只埋点） */
  UPGRADE_TOAST: '感谢反馈，第一版暂不收费',
  /** M11 无权限访问 */
  FORBIDDEN: '无权限访问',
} as const;
