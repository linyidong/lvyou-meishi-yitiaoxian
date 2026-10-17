/**
 * 提示文案常量（M01-M44）
 * 界面提示禁止写死中文，一律引用 MESSAGES.*。
 * M23 需要引用 B21（密码位数），M34/M36/M37 需要引用 B23/B01/B13，故此处 import BUSINESS，避免把数字写两遍。
 */
import { BUSINESS } from './business';

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
  /** M12 出行设置：出发城市必填（U05） */
  ORIGIN_CITY_REQUIRED: '出发城市为必填项，请先选择或手动输入你这次出发的城市',
  /** M13 出行设置：旅行城市必填（U05） */
  TRIP_CITY_REQUIRED: '请先选择旅行城市，再继续设置路线',
  /** M14 路线标题必填（U05） */
  ROUTE_TITLE_REQUIRED: '请填写路线标题',
  /** M15 提交参数不合法（服务端兜底） */
  INVALID_PARAMS: '提交的参数不合法，请检查后重试',
  /** M16 路线设置保存成功（U05，随后进入导入地点） */
  ROUTE_SETTINGS_SAVED: '路线设置已保存，正在进入导入地点…',
  /** M17 会员开通成功（U10 自助 / A03 管理员） */
  MEMBER_GRANTED: '已开通会员，会员权益即刻生效',
  /** M18 会员取消成功（A03） */
  MEMBER_REVOKED: '已取消会员，历史路线与收藏保留',
  /** M19 会员操作失败 */
  MEMBER_OP_FAILED: '会员服务暂时不可用，请稍后重试',
  /** M20 邮箱必填（U01 登录 / 注册） */
  AUTH_EMAIL_REQUIRED: '请输入邮箱',
  /** M21 邮箱格式不正确 */
  AUTH_EMAIL_INVALID: '邮箱格式不正确，请检查后重试',
  /** M22 密码必填 */
  AUTH_PASSWORD_REQUIRED: '请输入密码',
  /** M23 密码过短（位数取自 B21） */
  AUTH_PASSWORD_TOO_SHORT: `密码至少 ${BUSINESS.MIN_PASSWORD_LENGTH} 位`,
  /** M24 登录失败（邮箱或密码错误） */
  AUTH_LOGIN_FAILED: '邮箱或密码不正确，请重试',
  /** M25 注册成功且已登录 */
  AUTH_REGISTER_OK: '注册成功，已为你登录',
  /** M26 注册成功但需邮箱确认 */
  AUTH_REGISTER_NEED_CONFIRM: '注册成功！请到邮箱点击确认链接后再登录',
  /** M27 邮箱已被注册 */
  AUTH_EMAIL_EXISTS: '该邮箱已注册，请直接登录',
  /** M28 退出登录成功 */
  AUTH_LOGOUT_OK: '已退出登录',
  /** M29 非管理员账号登录管理端 */
  AUTH_ADMIN_ONLY: '该账号不是管理员，无法进入管理后台',
  /** M30 个人中心的管理后台入口标题（仅管理员渲染） */
  ADMIN_ENTRY_TITLE: '进入管理后台',
  /** M31 个人中心的管理后台入口说明 */
  ADMIN_ENTRY_DESC: '管理用户、路线与地点数据；该入口只对管理员账号显示',
  /** M32 邮箱未确认（Supabase 开启了邮箱确认，用户还没点邮件里的链接） */
  AUTH_EMAIL_NOT_CONFIRMED: '这个邮箱还没完成确认，请先到邮箱点确认链接，再回来登录',
  /** M33 后端连不上（DNS / 代理 / Supabase 地址配置错误，与密码无关） */
  SERVICE_UNREACHABLE: '暂时连不上服务器，请检查网络或 Supabase 地址配置后重试',
  /** M34 导入文案超长（U06，上限取自 B23） */
  IMPORT_TEXT_TOO_LONG: `内容超过 ${BUSINESS.MAX_IMPORT_TEXT_LENGTH} 字，请分次导入`,
  /** M35 生成路线至少 2 个地点（U07） */
  ROUTE_MIN_PLACES: '至少勾选 2 个地点才能生成路线',
  /** M36 单日地点数超上限（U07，上限取自 B01） */
  ROUTE_DAY_LIMIT_EXCEEDED: `单日最多 ${BUSINESS.MAX_PLACES_PER_DAY} 个地点，请减少勾选后再生成`,
  /** M37 单条路线地点数超上限（U07，上限取自 B13） */
  ROUTE_PLACES_LIMIT_EXCEEDED: `单条路线最多 ${BUSINESS.MAX_PLACES_PER_ROUTE} 个地点，请减少勾选后再生成`,
  /** M38 正在生成路线（U07） */
  ROUTE_GENERATING: '正在按顺路顺序排路线…',
  /** M39 路线不存在或非本人（U06 / U07 / U09） */
  ROUTE_NOT_FOUND: '这条路线不存在，或仅创建者可见',
  /** M40 注册邮件发送失败（D4，不再回显 GoTrue 英文原文） */
  AUTH_REGISTER_MAIL_FAILED: '注册邮件发送失败，请稍后重试或联系管理员',
  /** M41 手动添加地点重名（U06） */
  PLACE_NAME_DUPLICATE: '当前城市已有同名地点，请更换名称',
  /** M42 手动添加地点名称过短（U06） */
  PLACE_NAME_TOO_SHORT: '地点名称至少 2 个字',
  /** M43 地点批量添加成功（U06，count 为实际插入数） */
  PLACES_ADDED: (count: number) => `已成功添加 ${count} 个地点`,
  /** M44 注册失败兜底（D4，其余情况不再回显 GoTrue 英文原文） */
  AUTH_REGISTER_FAILED: '注册失败，请稍后重试或联系管理员',
  /** M45 删除用户账号成功（A03） */
  USER_DELETED: '该账号已删除',
  /** M46 删除用户账号失败（A03） */
  USER_DELETE_FAILED: '删除失败，请稍后重试',
  /** M47 只能删除普通用户（A03，管理员账号与自己的账号不可删） */
  USER_DELETE_FORBIDDEN: '只能删除普通用户账号，管理员账号不可删除',
  /** M48 删除账号的二次确认说明（A03，参数为待删账号邮箱） */
  USER_DELETE_CONFIRM: (email: string) =>
    `删除后该账号无法登录，其地点、路线与导入记录会一并清除，且不可恢复。确认删除 ${email} 吗？`,
  /** M49 管理员默认最高级会员，不可开通或取消（A03 与 /api/admin/member） */
  ADMIN_MEMBER_FIXED: '管理员账号默认享有最高级会员，无需开通或取消',
} as const;
