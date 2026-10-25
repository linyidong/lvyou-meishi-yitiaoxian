/**
 * 提示文案常量（M01-M44）
 * 界面提示禁止写死中文，一律引用 MESSAGES.*。
 * M23 需要引用 B21（密码位数），M34/M36/M37 需要引用 B23/B01/B13，故此处 import BUSINESS，避免把数字写两遍。
 */
import { BUSINESS } from './business';
import { PLACE_TYPE } from './enums';
import type { PlaceIconKey } from '@/lib/place-icon';

export const MESSAGES = {
  /** M01 只粘贴了链接 */
  LINK_NEED_TEXT: '请补充笔记文案或分享文案，以便提取地点',
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
  /** M11a 未登录（API 服务端兜底） */
  LOGIN_FIRST: '请先登录',
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
  ROUTE_DAY_LIMIT_EXCEEDED: (limit: number) => `单日最多 ${limit} 个地点，请减少勾选后再生成`,
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
  /** M42a T-049 业务开关关闭时 OCR 接口的 403 文案 */
  OCR_FEATURE_DISABLED: '图片识别功能当前已关闭，请稍后再试',
  /** M42b T-049 业务开关关闭时导入地点接口（extract / places）的 403 文案 */
  IMPORT_FEATURE_DISABLED: '导入地点功能当前已关闭，请稍后再试',
  /** M43 地点批量添加成功（U06，count 为实际插入数） */
  PLACES_ADDED: (count: number) => `已成功添加 ${count} 个地点`,
  /** M44 注册失败兜底（D4，其余情况不再回显 GoTrue 英文原文） */
  AUTH_REGISTER_FAILED: '注册失败，请稍后重试或联系管理员',
  /**
   * 阶段 2 会员分层：服务端限额校验提示（错误码见 config/enums.ts QUOTA_ERROR）。
   * 服务端返回 message 时直接取这些函数渲染好的文案。
   */
  /** 当天「生成路线」次数用完（正常用户按天，limit 为每天上限） */
  ROUTE_DAILY_LIMIT_REACHED: (limit: number) =>
    `今天的路线生成次数已用完（正常版每天最多 ${limit} 次），升级会员可提高上限`,
  /** 当月「生成路线」次数用完（会员按月，limit 为每月上限） */
  ROUTE_MONTHLY_LIMIT_REACHED: (limit: number) =>
    `本月的路线生成次数已用完（会员每月最多 ${limit} 条），下个月 1 号自动恢复`,
  /** 多日行程仅会员可用（正常用户永久 1 次试用额度已用） */
  ROUTE_MULTI_DAY_MEMBER_ONLY:
    '多日行程为会员功能：正常版仅支持单日，你的 1 次多日试用额度已用完，升级会员后可创建多日行程',
  /** 单日地点数超当前角色上限（limit 为当前角色单日上限） */
  ROUTE_DAY_PLACES_LIMIT: (limit: number) => `单日最多 ${limit} 个地点，升级会员可提升上限`,
  /** 当天 AI 提取地点次数用完（limit 为当前角色每天上限） */
  AI_EXTRACT_DAILY_LIMIT_REACHED: (limit: number) =>
    `今天的 AI 提取次数已用完（当前每天最多 ${limit} 次），升级会员可提高上限`,
  /** 未登录访客的 AI 提取日限流提示（B08 允许试用，但需限次避免被刷额度） */
  AI_EXTRACT_GUEST_LIMIT_REACHED: `未登录试用的 AI 提取次数已用完（每天最多 ${BUSINESS.GUEST_TRY_RATE_LIMIT_PER_DAY} 次），注册后可每天提取 ${BUSINESS.FREE_AI_EXTRACT_DAILY_LIMIT} 次`,
  /** U05 新建路线页按角色展示的配额说明 */
  TRIP_TIER: {
    /** 正常用户：单日 · 单日地点上限 */
    free: (placesPerDay: number) => `正常版：单日行程 · 单日最多 ${placesPerDay} 个地点`,
    /** 正常用户的 1 次永久多日试用额度说明 */
    freeTrial: '正常用户可用 1 次多日行程（永久一次，用完后需升级会员）',
    /** 会员：多日天数上限 · 单日地点上限 */
    member: (maxDays: number, placesPerDay: number) =>
      `会员版：多日最多 ${maxDays} 天 · 单日最多 ${placesPerDay} 个地点`,
    /** 管理员：不限 */
    admin: '管理员：不限次数、天数与地点数',
    /** 升级会员入口按钮 */
    upgrade: '升级为会员',
  },
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
  /** M50 管理后台侧边栏「返回用户端」入口（A01-A07） */
  ADMIN_BACK_TO_SITE: '返回用户端',
  /** M51 U04 页面标题 */
  CITY_TITLE: '这次去哪座城市？',
  /** M52 U04 标题说明（原型为三行，逐行展示） */
  CITY_DESC_LINES: [
    '一条路线只对应一座城市，导入的地点会在该城市范围内规划。',
    '选中热门城市后，可在卡片下方继续挑选城市内地名或同省/周边城市，把目的地落到更小的地方。',
    '第一版仅支持国内城市。',
  ],
  /** M53 U04 搜索框占位（支持城市名 / 城市内地名 / 周边城市 / 拼音首字母如 hz） */
  CITY_SEARCH_PLACEHOLDER: '搜索城市或地名，如：成都、西湖、hz、平潭',
  /** M54 U04 热门城市分区标题 */
  CITY_HOT_TITLE: '热门城市 · 点击城市可展开二级目的地',
  /** M55 U04 模拟数据说明（原型右上方小字） */
  CITY_MOCK_NOTE: '城市、城市内地名与周边城市均为模拟数据',
  /** M56 U04 底部选择条左侧标签 */
  CITY_SELECTED_LABEL: '已选择',
  /** M57 U04 尚未选择城市 */
  CITY_NOT_SELECTED: '尚未选择城市',
  /** M58 U04 下一步按钮（原型为「下一步：设置路线」） */
  CITY_NEXT_STEP: '下一步：设置路线',
  /** M59 U04 搜索结果分区标题 */
  CITY_SEARCH_RESULT: '搜索结果',
  /** M60 U04 搜索无结果标题 */
  CITY_SEARCH_EMPTY_TITLE: '没有匹配的城市',
  /** M61 U04 搜索无结果说明 */
  CITY_SEARCH_EMPTY_DESC: '换个关键词再试，或清空搜索看看全部城市。',
  /** M62 U04 清空搜索按钮 */
  CITY_SEARCH_CLEAR: '清空搜索',
  /** M63 U04 因二级地名匹配到城市（参数：地名、城市名） */
  CITY_MATCHED_BY_PLACE: (place: string, city: string) => `「${place}」属于 ${city}`,
  /** M64 U04 卡片展开二级目的地 */
  CITY_EXPAND: '展开城市内地名 / 周边城市',
  /** M65 U04 卡片收起二级目的地 */
  CITY_COLLAPSE: '收起城市内地名 / 周边城市',
  /** M66 U04 二级目的地分组标签：城市内地名 */
  CITY_DISTRICTS_LABEL: '城市内地名',
  /** M67 U04 二级目的地分组标签：周边城市 */
  CITY_NEARBY_LABEL: '周边城市',
  /** M68 U04 未完成路线的草稿提示（参数：路线标题） */
  CITY_DRAFT_HINT: (title: string) => `你还有一条未完成的路线：${title}。`,
  /** M69 U04 草稿提示的继续入口 */
  CITY_DRAFT_CONTINUE: '继续编辑',

  /** M71 顶部导航：首页 */
  NAV_HOME: '首页',
  /** M72 顶部导航：新建路线 */
  NAV_NEW_ROUTE: '新建路线',
  /** M73 顶部导航：我的路线 */
  NAV_MY_ROUTES: '我的路线',
  /** M74 顶部导航：收藏夹（原「我的收藏」，按 2026-10-18 需求改为「收藏夹」） */
  NAV_COLLECTED: '收藏夹',
  /** M75 顶部导航：个人中心 */
  NAV_PROFILE: '个人中心',
  /** M76 底部导航（移动端）：新建 */
  NAV_NEW_SHORT: '新建',
  /** M77 底部导航（移动端）：我的 */
  NAV_PROFILE_SHORT: '我的',
  /** M78 顶部导航未登录时的登录/注册按钮 */
  NAV_LOGIN_REGISTER: '登录 / 注册',
  /** M79 顶部导航未登录时的身份提示（游客模式） */
  NAV_GUEST: '游客模式',
  /** M79b 顶部导航游客态下需登录入口的提示（置灰不可点） */
  NAV_GUEST_LOCKED: '登录后即可使用',
  /** M80 头像菜单：退出登录 */
  MENU_LOGOUT: '退出登录',
  /** M81 头像菜单：退出中 */
  MENU_LOGGING_OUT: '退出中…',
  /** M82 头像右侧会员徽章（member=true 的普通用户） */
  MENU_BADGE_VIP: 'VIP',
  /** M83 头像右侧管理员徽章（role=admin，默认最高级会员，比 vip 更醒目） */
  MENU_BADGE_ADMIN: '超级 VIP',

  /** M100 U01 / U02 示例路线（成都首日：站点名、距离、图例） */
  SAMPLE_ROUTE: {
    cityLine: '成都 · 第 1 天 · 步行',
    tag: '示例',
    stations: ['宽窄巷子', '陈麻婆豆腐', '人民公园', '钟水饺', '春熙路'],
    /** T-035 示意路线各站点类型（与 stations 顺序一一对应：景点/美食） */
    stationTypes: [
      PLACE_TYPE.ATTRACTION,
      PLACE_TYPE.FOOD,
      PLACE_TYPE.ATTRACTION,
      PLACE_TYPE.FOOD,
      PLACE_TYPE.ATTRACTION,
    ],
    /** T-036 示意路线各站点图标语义（与 stations 顺序一一对应，见 lib/place-icon.ts） */
    stationIconKeys: ['street', 'bowl', 'park', 'dumpling', 'shopping'] as PlaceIconKey[],
    /** T-039 首页示意图专用（与登录页分开，保证 5 个图标形状两两不同；tree 仅此处使用） */
    homeStationIconKeys: ['street', 'hotpot', 'tree', 'dumpling', 'shopping'] as PlaceIconKey[],
    /** U01 左侧面板示意路线脚注 */
    footNote: '步行约 3.2 公里 · 示意路线',
    /** U02 右侧示意图脚注 */
    distance: '约 4.1 公里 · 55 分钟',
    legendAttraction: '景点',
    legendFood: '美食',
  },
  /** M101 U01 左侧渐变面板文案 */
  LOGIN_HERO: {
    titleLines: ['收藏夹里的景点和美食，', '一键排成顺路的一条线'],
    desc: '从小红书粘贴笔记文案、从抖音粘贴文案或链接，自由勾选想去的地点，系统按顺路顺序排好路线，你只需微调。',
    tagline: '适合大学生、情侣、宝妈、家庭出游和旅游博主',
  },
  /** M102 U01 表单文案（含找回密码提示、登录中 / 注册中） */
  LOGIN_FORM: {
    tabLogin: '登录',
    tabRegister: '注册',
    titleLogin: '欢迎回来',
    titleRegister: '创建账号，开始排路线',
    emailLabel: '邮箱',
    emailPlaceholder: '例如 xiaoman@qq.com',
    /** 登录/注册两个 tab 共用的邮箱小提醒（T-032） */
    emailHint: '建议使用常用邮箱注册登录',
    usernameLabel: '用户名',
    usernameOptional: '（选填）',
    usernamePlaceholder: '不填写则显示邮箱前缀',
    passwordLabel: '密码',
    passwordPlaceholder: `至少 ${BUSINESS.MIN_PASSWORD_LENGTH} 位，包含字母和数字`,
    remember: '7 天内自动登录',
    forgot: '忘记密码？',
    submitLogin: '登录',
    submitRegister: '注册并登录',
    submitBusyLogin: '登录中…',
    submitBusyRegister: '注册中…',
    tryGuest: '先不登录，直接试用',
    /** 带着本地草稿进入登录页时的暂存提示 */
    fromDraftTip: '你的路线已暂存为本地草稿，登录后将自动合并到账号并继续保存。',
  },

  /**
   * U01 忘记密码 · 自助重置（无邮件通道版）。
   * 自建 Supabase 没有 SMTP，发不出重置邮件，故改成「凭注册邮箱直接设新密码」；
   * 只改登录凭证、不动 public.users，会员权益保持不变。接口见 app/api/auth/reset-password/route.ts。
   */
  RESET_PASSWORD: {
    title: '重置密码',
    desc: '输入注册邮箱和新密码即可重置。账号不变，会员权益保持不变。',
    hint: '提示：换成新密码后用新密码登录即可，无需重新注册。',
    newPasswordLabel: '新密码',
    confirmLabel: '确认新密码',
    confirmPlaceholder: '再次输入新密码',
    submit: '重置密码',
    submitBusy: '重置中…',
    backToLogin: '返回登录',
    okNotice: '密码已重置，请用新密码登录。',
    errNotRegistered: '该邮箱尚未注册，请检查后重试',
    errAdminBlocked: '管理员账号不支持自助重置，请联系系统开发者处理',
    errMismatch: '两次输入的密码不一致',
    errFailed: '密码重置失败，请稍后重试',
    errTooMany: '重置请求过于频繁，请稍后再试',
    /** 重置成功后外发提醒给管理员（复用订单提醒同一批通道） */
    notifyTitle: '【提醒】有用户重置了登录密码',
    notifyLineUser: (email: string) => `**用户**：${email}`,
    notifyLineTime: (at: string) => `**时间**：${at}`,
    notifyFooter: '若非本人操作，请尽快联系该用户核实账号安全。',
  },
  /** M103 U02 首页首屏文案 */
  HOME_HERO: {
    badge: '公开测试版 · 国内城市',
    titleLines: ['把收藏的景点和美食', '排成顺路的一条线'],
    descLines: [
      '小红书笔记文案粘贴，抖音文案与链接，AI 帮你找出地点。',
      '想去哪里自己勾，帮你按就近顺路排好路线，尽量不再来回绕路留遗憾',
    ],
    ctaPrimary: '开始排路线',
  },
  /** M104 U02 草稿提示条文案（infoImported 用于本地草稿，infoUnfinished 用于账号内未生成路线的草稿） */
  HOME_DRAFT: {
    title: '你有一条未保存的路线草稿',
    continue: '继续编辑',
    infoImported: (city: string, count: number) => `${city} · 已导入 ${count} 个地点 · 尚未生成路线`,
    infoUnfinished: (city: string) => `${city} · 尚未生成路线`,
  },
  /** M105 U02「导入地点美食先收藏」区块文案 */
  HOME_COLLECT: {
    title: '导入地点美食先收藏',
    badgeNew: '本期新增',
    badgePrd: '超出 PRD P0，待产品确认',
    desc: '小红书请粘贴笔记文案（链接读不到正文），抖音可粘贴分享文案或链接。AI 提取地点后存进你的收藏地点，暂时不用建路线。',
    count: (n: number) => `我的收藏地点：${n} 个`,
    hintEmpty: '还没有收藏，先粘贴一段小红书文案或抖音文案/链接试试',
    hintHas: '详情见“我的收藏地点”',
    btnImport: '粘贴文案 / 链接导入',
    btnCollected: '我的收藏地点',
  },
  /** M106 U02「粘贴笔记文案 · AI 提取收藏」流程文案 */
  HOME_IMPORT: {
    summary: '把小红书笔记里的文案复制过来粘贴，抖音可粘贴文案或链接，AI 提取后直接收藏',
    tabText: '粘贴笔记文案',
    tabLink: '粘贴链接（抖音等）',
    linkTip:
      '小红书：链接读不到正文，只能粘贴笔记文案；抖音等平台：可粘贴分享链接，系统会尝试读取链接里的内容，读不到时再补充分享文案。',
    placeholderText: '例如：成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐……',
    placeholderLink: '粘贴分享链接（抖音等可读），例如：https://v.douyin.com/xxxx',
    needText: '请先粘贴小红书笔记文案，或抖音等平台的分享链接',
    needTextTitle: '没能读到这个链接的内容，请改用「粘贴笔记文案」',
    needTextDesc:
      '小红书链接因需要登录、正文由前端动态渲染，服务端读不到，请直接用「粘贴笔记文案」：把小红书笔记里的文案复制过来粘贴进来。抖音等平台的链接可以尝试直接读取，读不到时再补充分享文案；也可以手动输入笔记里提到的地点。',
    sampleLabel: '试试示例：',
    samples: [
      {
        label: '小红书笔记文案（链接无效）',
        value:
          '成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐，下午人民公园喝盖碗茶，晚上春熙路+太古里逛街，宵夜钟水饺和贺记蛋烘糕！第二天武侯祠、锦里古街，晚饭蜀九香火锅 📍王妈手撕烤兔 #成都美食 #成都旅行',
      },
      {
        label: '抖音文案+链接',
        value:
          '成都本地人私藏的 5 家苍蝇馆子！洞子口张老二凉粉、龙抄手、冒椒火辣、马旺子川菜，吃完去九眼桥吹风～ 复制打开抖音，看看【小满吃遍成都的作品】 https://v.douyin.com/iRkM8sQx/',
      },
      {
        label: '只有链接（抖音）',
        value: 'https://v.douyin.com/iRkM8sQx/',
      },
      {
        label: '无地点文案',
        value: '这次旅行太开心了！天气超好，吃得也很满足，强烈推荐大家秋天来玩～ #旅行日记',
      },
    ],
    extract: 'AI 提取地点',
    extractBusy: 'AI 正在识别…',
    /** 粘贴的是链接时，先读取链接内容的中间态（U02） */
    linkBusy: '正在读取链接内容…',
    manual: '不识别，手动输入地点',
    manualTitle: '手动输入地点',
    manualNamePlaceholder: '输入地点名称，如：鹤鸣茶社',
    manualAdd: '添加',
    manualEmptyName: '请输入至少 2 个字的地点名称',
    manualDuplicate: (name: string) => `「${name}」已在列表中`,
    resultTitle: (n: number) => `识别到 ${n} 个地点，勾选后收藏`,
    resultNote: 'AI 解析仅供参考，可修改名称与类型；重复地点会提示合并或跳过',
    /** 城市识别：AI 先从文案里取城市，地点与美食按该城市收藏 */
    cityLabel: '收藏城市',
    cityHint: 'AI 会先识别文案里的城市，下面的地点和美食都收藏到这个城市下',
    cityPick: '请选择城市',
    cityAuto: (name: string) => `AI 识别到城市：${name}`,
    /** T-042：AI 识别的城市不在内置列表时不再要求手动选择，收藏时自动加入城市库（游客链路：识别阶段不写库） */
    cityMissing: (name: string) => `“${name}”将作为新城市加入城市库`,
    /** T-043：登录用户在识别阶段即入库，新城市即时生效 */
    cityAdded: (name: string) => `“${name}”为新城市，已加入城市库`,
    /** 自动入库失败（如城市表写入出错）时的兜底提示：地点仍已收藏，但城市为空 */
    cityMissingSaved: (name: string) =>
      `“${name}”未能加入城市库，地点已收藏但未指定城市`,
    cityUnknown: 'AI 没识别出城市，请手动选择（不选则收藏时城市为空）',
    repaste: '重新粘贴',
    save: (n: number) => `确认收藏 ${n} 个地点`,
    saveNote: '收藏后可在“我的收藏地点”随时加入路线',
    noResult: '没有识别到地点，可换一段文案或手动输入',
    /** 0 结果时展开的说明：小红书只有标题、链接读不到；抖音链接可读 */
    noResultTitle: '这段内容里没有可识别的地点名',
    noResultDesc:
      '这段内容通常只有笔记标题，没有具体地点名。小红书正文在 App 内、链接也读不到，请长按复制笔记正文再粘贴；抖音链接能直接读，读不到时请补充分享文案。也可以手动输入地点。',
    linkFailNote:
      '说明：小红书链接读不到正文是正常现象（需登录才能查看），并非故障；小红书请改用粘贴文案，抖音链接才支持直接读取。',
    goManual: '去手动输入地点',
    savedWithCity: (n: number, city: string) =>
      `已收藏 ${n} 个地点到「${city}」，可在“我的收藏地点”加入路线`,
    savedNoCity: (n: number) => `已收藏 ${n} 个地点（未指定城市），可在“我的收藏地点”加入路线`,
    /** T-044 图片识别（OCR）标签页 */
    tabImage: '图片识别',
    imageTip:
      '上传小红书 / 抖音笔记截图，系统识别图中文字并填入下方文本框，再点「AI 提取地点」即可。图片仅用于识别，不会保存。',
    imagePrivacy: '图片仅用于识别，不会保存',
    imageChoose: '选择图片',
    imagePaste: '粘贴图片',
    imagePasteHint: '也可以复制图片后直接按 ⌘/Ctrl + V 粘贴',
    imageSubmit: '识别图片',
    imageBusy: '正在识别图片…',
    imageNoFile: '请先选择一张图片',
    imageTooLarge: '图片超过 7MB，请换一张小一点的图片',
    imageBadType: '仅支持 JPG / PNG / WebP 格式的图片',
    imageNeedLogin: '图片识别需登录后使用，请先登录',
    imageNotConfigured: '图片识别服务暂未开通，请联系管理员',
    imageFailed: '图片识别失败，请稍后重试',
    imageEmpty: '图片里没识别到文字，换一张清晰的截图试试',
    /** 识别成功：文本已回填文本框，提示下一步动作 */
    imageDone: (n: number) => `已识别 ${n} 行文字，可点下方「AI 提取地点」`,
    imageQuota: (n: number) => `今日图片识别次数已用完（${n} 次/日），明天再来吧`,
    /** T-051 业务开关关闭态提示（管理后台「导入地点 / 图片识别」开关） */
    importPaused: '导入地点功能已暂停，请稍后再试',
    ocrPaused: '图片识别功能已暂停，请稍后再试',
  },
  /** M107 U02「四步排好一条线」 */
  HOME_STEPS: {
    title: '四步排好一条线',
    steps: [
      { no: '01', title: '选城市', desc: '先定这次要去的城市，地点只在该城市内规划。' },
      {
        no: '02',
        title: '粘贴文案 / 抖音链接导入',
        desc: '小红书粘贴笔记文案，抖音可粘贴文案或链接；AI 提取地点，你来确认和修改。',
      },
      {
        no: '03',
        title: '勾选想去的',
        desc: '不必照搬别人的路线，自由勾选，选单日或多日、步行或骑行。',
      },
      {
        no: '04',
        title: '自动排线，微调保存',
        desc: '按顺路顺序生成，上下调整后保存，截图即可分享给同伴。',
      },
    ],
  },
  /** M108 U02「我的最近路线」 */
  HOME_RECENT: {
    title: '我的最近路线',
    viewAll: '查看全部',
    guestEmpty: '登录后可在这里查看保存过的路线',
    guestLogin: '去登录',
    noneEmpty: '还没有保存的路线',
    noneCreate: '创建第一条路线',
    meta: (city: string, days: number, count: number, transport: string) =>
      `${city} · ${days} 天 · ${count} 个地点 · ${transport}`,
  },
  /** M109 U02「和照搬路线不一样」 */
  HOME_DIFF: {
    title: '和照搬路线不一样',
    items: [
      '导入别人的攻略后，可以自由勾选、增删',
      '系统按你的选择重新规划顺路顺序',
      '多日行程自动按天分组',
      '结果页简洁，适合直接截图分享',
    ],
  },
  /** M110 未登录试用提示（U01 信息行 / U02 首屏小字共用） */
  GUEST_TRY_HINT: '未登录可先试用，保存路线需登录',
  /** M111 A01 管理员登录文案（与 U01 共用表单，管理端无左侧面板） */
  ADMIN_LOGIN: {
    title: 'A01 管理员登录',
    desc: '仅 role=admin 的账号可进入管理后台；普通账号登录后会被拦下。',
  },
  /** M112 未填写城市时的占位文案（U02 最近路线卡） */
  UNSPECIFIED_CITY: '未指定城市',

  /** M120 真实高德地图区块（U03 / U08 / U09 共用） */
  MAP: {
    /** 有坐标的地点不足 2 个，画不出路线时的占位文案 */
    NO_COORDS: '这些地点还没有坐标，补全后这里会显示真实地图',
    /** 高德 JS API 正在加载 */
    LOADING: '地图加载中…',
    /** 高德 JS API 加载失败（网络或 Key 配置问题） */
    LOAD_FAILED: '地图加载失败，请检查网络后刷新重试',
    /** 周边知名地点的图例说明（灰色小点，弱于自己的编号站点） */
    LANDMARK_LEGEND: '周边知名地点',
  },

  /** M140 U03 我的路线：页头 / 空态 / 失败重试 / 无权限 */
  MY_ROUTES: {
    /** 卡片副行：天数 / 地点数（含美食数）/ 保存时间 */
    meta: (days: number, places: number, foods: number, savedAt: string) =>
      `${days} 天 · ${places} 个地点（美食 ${foods}）· 保存于 ${savedAt}`,
    originPending: '出发城市待补充',
    originFrom: (city: string) => `${city} 出发`,
    lodging: (label: string, nights: number | null) =>
      nights ? `${label} ${nights} 晚` : label,
    view: '查看路线',
    edit: '继续调整',
    title: '我的路线',
    /** 副标题：共 N 条路线，仅自己可见 */
    subtitle: (n: number) => `共 ${n} 条路线 · 仅自己可见`,
    /** 未登录兜底页的说明文案 */
    headDesc: '已保存的路线都在这里，可随时打开查看或继续调整',
    /** 城市筛选 tab 的「全部」 */
    all: '全部',
    create: '新建路线',
    emptyTitle: '还没有保存的路线',
    emptyDesc: '生成路线后点击“保存路线”，就会出现在这里',
    emptyCta: '创建第一条路线',
    footnote: '第一版不提供公开路线浏览，路线仅自己可见（数据模型预留 is_public 字段）',
    errorTitle: '路线列表加载失败',
    errorDesc: '服务暂时不可用，请稍后重试',
    retry: '重新加载',
    deniedTitle: '登录后才能查看我的路线',
    deniedDesc: '路线需要保存到账号，未登录时只保留一份本地草稿',
    login: '登录 / 注册',
    /** T-041 拆分两个模块：自建路线 / 由分享导入的路线（无数据时后者不显示） */
    sectionMine: '我的路线',
    sectionShared: '会员分享路线',
  },
  /** M141 U04 选择城市：标题、三段说明、搜索占位、热门区标题与底部选择条（按原型原文，不复用 M51-M69） */
  CITY_HERO: {
    title: '这次去哪座城市？',
    descLine1: '一条路线只对应一座城市，导入的地点会在该城市范围内规划。',
    descLine2Prefix: '选中热门城市后，可在卡片下方继续挑选',
    descDistricts: '城市内地名',
    descOr: '或',
    descNearby: '同省 / 周边城市',
    descLine2Suffix: '，',
    descLine3: '把目的地落到更小众的地方。第一版仅支持国内城市。',
    /** 右侧搜索框占位（原型为「杭州、西湖、hz、平潭」） */
    searchPlaceholder: '搜索城市或地名，如：杭州、西湖、hz、平潭',
    /** 热门城市分区标题（原型：主文案 + 浅色补充说明） */
    hotTitle: '热门城市',
    hotTitleNote: '· 点击城市可展开二级目的地',
    /** 游客态：热门区补充说明（游客只能挑库内已有地点，因此仅部分城市可试用） */
    hotTitleNoteGuest: '· 仅带颜色的城市可试用',
    /** 游客态：城市卡片角标 —— 库内已有可勾选数据的城市 */
    badgeHasData: '示例数据最全',
    /** 游客态：城市卡片角标 —— 库内暂无数据的城市（卡片置灰且不可点击） */
    badgeNoData: '暂无数据',
    /** 热门区右上角模拟数据说明 */
    mockNote: '城市、城市内地名与周边城市均为模拟数据',
    /** 底部选择条：左侧小字标签 */
    selectedLabel: '已选择',
    /** 底部选择条：未选中任何城市 */
    notSelected: '尚未选择城市',
    /** 底部选择条：下一步按钮 */
    nextStep: '下一步：设置路线',
    /** 草稿提示条（文案沿用原型「你还有一条未保存的草稿」，数据源为账号内未生成路线的草稿标题） */
    draftHint: (title: string) => `你还有一条未保存的草稿：${title}。`,
    /** 草稿提示条：继续编辑入口 */
    draftContinue: '继续编辑草稿',
    /** 底部选择条：二级目的地为城市内地名时展示（参数：目的地、所属城市） */
    selectedDestCity: (dest: string, city: string) => `目的地：${dest}（${city}）`,
    /** 底部选择条：二级目的地为周边城市时展示（参数：目的地、所属城市） */
    selectedDestNear: (dest: string, city: string) => `目的地：${dest}（周边城市）（${city}）`,
  },
  /** M142 U04 搜索无结果态（原型：没有找到“关键词” + 说明 + 清空搜索） */
  CITY_SEARCH: {
    /** 无结果标题（参数为输入的关键词） */
    emptyTitle: (kw: string) => `没有找到“${kw}”`,
    emptyDesc: '第一版暂只开放下列国内热门城市，更多城市陆续上线',
    clear: '清空搜索',
  },
  /** M143 U04 卡片与二级目的地板块 */
  CITY_DEST: {
    /** 卡片底部：未选中 / 选中 */
    cardExpand: '展开城市内地名 / 周边城市',
    cardCollapse: '收起二级目的地',
    /** 二级目的地板块 */
    panelBadge: '模拟数据',
    panelTitle: (city: string) => `${city} · 二级目的地`,
    panelCollapse: '收起',
    groupCity: '城市内地名',
    groupCityHint: '把行程落到更具体的街区 / 景区',
    groupNearby: '同省 · 周边城市与县镇',
    groupNearbyHint: '想去小众地方，可以把目的地放到邻近城市',
    footnote:
      '选“城市内地名”时行程仍在该城市范围内规划；选“同省 / 周边城市”会以该目的地作为旅行城市（标注为周边城市，模拟数据，未接入真实路线）。',
    empty: (title: string) => `该城市暂未配置${title}`,
  },
  /** M144 U05 页头 + 本期新增说明 */
  TRIP_HERO: {
    title: '设置这条路线',
    desc: '先给路线起个名字，再决定从哪出发、怎么去、玩几天、到了住哪儿。这些设置之后都能在路线编辑页里随时改。',
    newInfoTitle: '本期新增：出发城市 · 城际交通 · 终点城市住宿（超出原 PRD P0 范围，需产品确认后进入编码）',
    newInfoDesc1: '原 PRD 只把市内交通定为“步行 / 骑行”，本版已扩为“步行 / 骑行 / 公交地铁 / 驾车”。本页新增的出发城市、城际交通（去程）与终点城市住宿均为',
    newInfoDescStrong: '前端模拟数据',
    newInfoDesc2: '，未接入真实票务或住宿服务，也不会真实下单。',
  },
  /** M145 U05 旅行城市卡片（来自 /city） */
  TRIP_CITY: {
    label: '旅行城市（目的地 · 来自 /city）',
    change: '重新选择城市',
    pick: '去选择城市',
    sameCityTag: '即旅行城市',
    /** 未从 /city 带入城市时的卡片占位（原型 JS 为「尚未选择城市」） */
    none: '尚未选择城市',
    /** 二级目的地后缀：目的地与旅行城市相同（周边城市） */
    nearbyTag: '（周边城市）',
    /** 二级目的地为城市内地名时的括号标注（参数：目的地、所属城市） */
    cardDest: (dest: string, city: string) => `${dest}（${city}）`,
    /** 出行设置里「旅行城市」的兜底文案（未选城市 / 未带二级目的地） */
    destFallback: '旅行目的地',
    guidePre: '还没有选定旅行城市。你可以先',
    guideLink: '去 /city 选择城市',
    guidePost: '，也可以继续浏览下面的路线设置，选完城市会自动回到这里；确定好城市后，还可以用上面的“手动输入出发城市”把出发城市补上。',
    /** 点「下一步」被拦截时的引导条文案（红色错误态） */
    guideBadPre: '还没有选择旅行城市，无法进入下一步。请先',
    guideBadPost: '，选完城市会自动回到这里继续设置。',
  },
  /** M146 U05 出行设置三块表单文案 */
  TRIP_FORM: {
    badgeRequired: '必填',
    badgeOptional: '选填',
    badgeNew: '本期新增',
    originTitle: '出发城市',
    originDesc1: '你这次从哪座城市出发（居住地或上一站），用于估算城际交通。出发城市与上面的“旅行城市”（',
    originDesc2: '）是两个不同概念，请不要选成同一段行程。',
    originSearchPlaceholder: '搜索出发城市，如：重庆、cq',
    /** T-015 出发城市网格分组小标题（T-016 起网格只展示热门+手动添加） */
    originHotTitle: '热门城市',
    originCustomTitle: '手动添加',
    originManual: '没找到？手动输入出发城市名',
    originManualPlaceholder: '输入出发城市名',
    originManualUse: '使用',
    originNoResult: '没有匹配的国内城市，可点上面的“手动输入出发城市名”直接填写',
    originSame: '同城出发，无需城际交通。下面“城际交通·去程”可保持“暂不设置”。',
    intercityTitle: '城际交通 · 去程',
    intercityDesc1: '出发城市 → 旅行城市的',
    intercityDescStrong: '大交通',
    intercityDesc2: '方式，与下面“市内交通”（步行 / 骑行 / 公交地铁 / 驾车）是两回事。这里只做行程信息记录，不会查询班次或票价。',
    intercityHintNoOrigin: '先填写出发城市，再选择去程交通方式。',
    intercityHintSameCity: '同城出发，无需城际交通。',
    intercityHintSet: (origin: string, city: string, mode: string) =>
      `去程：${origin} → ${city} · ${mode}（仅记录行程信息，不查询班次与票价）`,
    intercityHintNone: '当前暂不设置去程交通方式，之后可在路线编辑页补充。',
    lodgingTitle: '终点城市住宿',
    lodgingDesc1: '到',
    lodgingDesc2: '之后的住宿安排，仅记录信息，不代订房。',
    /** 住宿卡片里「旅行城市」的兜底文案 */
    lodgingDestFallback: '旅行城市',
    lodgingNeedQ: '是否需要住宿',
    lodgingYes: '需要住宿',
    lodgingNo: '暂不预订',
    lodgingTypeLabel: '住宿类型',
    areaLabel: '住宿区域',
    areaPlaceholder: '例如：宽窄巷子附近',
    nameLabel: '酒店 / 民宿名称（选填）',
    namePlaceholder: '例如：某民宿（可不填）',
    nightsLabel: '入住天数',
    nightsMinus: '减少入住天数',
    nightsPlus: '增加入住天数',
    nightsText: '共住',
    nightsUnit: '晚',
    nightsSync: '按行程天数填满',
    nightsWarnOver: (nights: number, days: number) =>
      `入住 ${nights} 晚多于${days === 1 ? '单日（1 天）行程' : `行程共 ${days} 天`}，请确认是否真的住这么多天。`,
    nightsWarnUnder: (days: number, nights: number) =>
      `${days === 1 ? '单日（1 天）行程' : `行程共 ${days} 天`}通常需要 ${Math.max(1, days - 1)} 晚住宿，当前只填了 ${nights} 晚。`,
    placeholder: '暂不预订：不会记录住宿信息，之后可在路线编辑页补充',
  },
  /** M147 U05 路线标题字段 */
  TRIP_TITLE: {
    label: '路线标题',
    desc: `标题会自动带上当前城市名，你只需要填写城市名后面的部分，最多 ${BUSINESS.MAX_ROUTE_TITLE_LENGTH} 字`,
    placeholder: '例如：老城区半日骑行',
    /** 首次进入时的默认标题（原型 JS 预填「吃喝一条线」） */
    defaultTitle: '吃喝一条线',
    prefixTitle: '城市名前缀固定，不可修改',
    /** 未选定城市时的城市名前缀占位（原型 JS 为「未选城市 ·」） */
    prefixEmpty: '未选城市',
    prefixHint: '前缀是当前城市（在 /city 选定），不可直接修改；重新选择城市后前缀会自动同步，你写的标题保持不变',
    /** 字数计数：当前 / 上限 */
    count: (current: number, max: number) => `${current} / ${max}`,
    warnNear: (left: number) => `接近上限：还可再输入 ${left} 个字，建议精简一下`,
  },
  /** M148 U05 行程天数 */
  TRIP_DAYS: {
    label: '行程天数',
    desc: '多日路线会先按距离聚类，再把每天的地点均匀分配',
    minus: '减少天数',
    plus: '增加天数',
    single: '单日',
    singleSub: '1 天走完',
    many: '多日',
    manySub: `${BUSINESS.MIN_DAYS}–${BUSINESS.MAX_DAYS} 天`,
    unitPre: '共',
    unitPost: '天',
  },
  /** M149 U05 市内交通 */
  TRIP_TRANSPORT: {
    label: '市内交通',
    badge: '选填（默认步行）',
    desc1: '整条路线在',
    descStrong: '旅行城市内',
    desc2: '统一使用一种交通方式，用于估算距离和时间；与上面的“城际交通 · 去程”不是同一件事。',
  },
  /** M150 U05 底部操作 */
  TRIP_FOOTER: {
    back: '重新选择城市',
    next: '下一步：导入地点',
    nextErr: '出发城市为必填项，请先填写后再进入下一步',
  },
  /** M151 U04 城市列表加载失败（服务端查询失败态） */
  CITY_ERROR: {
    title: '城市列表加载失败',
    desc: '请检查网络后重试',
    retry: '重新加载',
  },
  /** M152 U04 城市表为空态 */
  CITY_EMPTY: {
    title: '暂无可选城市',
    desc: '城市配置正在更新，请稍后再来',
  },
  /** M153 U05 路线设置保存失败 */
  TRIP_SAVE_ERROR: {
    title: '路线设置保存失败',
    desc: '可能是网络问题，请稍后重试',
    retry: '重新保存',
  },
  /** M200 U06 导入地点（第 3 步）：页头、当前城市收藏区、导入卡、状态块、小贴士、无权限（按原型原文） */
  ROUTE_ADD: {
    /** 页头标题前缀（城市名以主色紧跟其后） */
    titlePrefix: '导入地点 ·',
    noCity: '未指定城市',
    desc: '小红书粘贴笔记文案、抖音可粘贴文案或链接，AI 帮你找出里面的景点和美食',
    /** 收藏区块 */
    favTitle: '当前城市的收藏地点和美食',
    favDesc: '来自「我的收藏」的地点，可一键加入当前路线，加入后同上写入本路线地点库。',
    favManage: '管理我的收藏',
    favTabAll: '全部',
    favSum: (total: number, spot: number, food: number) =>
      `当前城市共 ${total} 个收藏 · 景点 ${spot} · 美食 ${food}`,
    favAddAll: '全选加入',
    favInRoute: '已在本路线',
    favInRouteBtn: '已在当前路线',
    favAddOne: '加入当前路线',
    favEmptyFilter: '该分类下暂无收藏地点，切回“全部”看看',
    favEmptyTitle: '还没有收藏当前城市的地点，去导入文案',
    favEmptyDesc: '粘贴小红书笔记文案，或抖音的文案与链接，AI 提取地点后会先存进“我的收藏”，再回来一键加入路线。',
    favEmptyImport: '在本页粘贴文案 / 链接导入',
    favEmptyGo: '去我的收藏',
    noAddress: '待定位',
    /** 导入卡 */
    tabText: '粘贴笔记文案',
    tabLink: '粘贴链接（抖音等）',
    linkTip:
      '小红书：链接读不到正文，只能粘贴笔记文案；抖音等平台：可粘贴分享链接，系统会尝试读取链接里的内容，读不到时再补充分享文案。',
    placeholderText: '例如：成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐……',
    placeholderLink: '粘贴分享链接（抖音等可读），例如：https://v.douyin.com/xxxx',
    emptyInput: '请先粘贴小红书笔记文案，或抖音等平台的分享链接',
    needTextTitle: '没能读到这个链接的内容，请改用「粘贴笔记文案」',
    needTextDesc:
      '小红书链接因需要登录、正文由前端动态渲染，服务端读不到，请直接用「粘贴笔记文案」：把小红书笔记里的文案复制过来粘贴进来。抖音等平台的链接可以尝试直接读取，读不到时再补充分享文案；也可以手动输入笔记里提到的地点。',
    sampleLabel: '试试示例：',
    samples: [
      {
        label: '小红书笔记文案（链接无效）',
        value:
          '成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐，下午人民公园喝盖碗茶，晚上春熙路+太古里逛街，宵夜钟水饺和贺记蛋烘糕！第二天武侯祠、锦里古街，晚饭蜀九香火锅 📍王妈手撕烤兔 #成都美食 #成都旅行',
      },
      {
        label: '抖音文案+链接',
        value:
          '成都本地人私藏的 5 家苍蝇馆子！洞子口张老二凉粉、龙抄手、冒椒火辣、马旺子川菜，吃完去九眼桥吹风～ 复制打开抖音，看看【小满吃遍成都的作品】 https://v.douyin.com/iRkM8sQx/',
      },
      {
        label: '只有链接（抖音）',
        value: 'https://v.douyin.com/iRkM8sQx/',
      },
      {
        label: '无地点文案',
        value: '这次旅行太开心了！天气超好，吃得也很满足，强烈推荐大家秋天来玩～ #旅行日记',
      },
    ],
    extract: 'AI 提取地点',
    manual: '不导入，直接手动添加',
    importedPre: '本路线已导入',
    importedPost: '个地点，确认无误后去勾选',
    goSelect: '去勾选地点',
    /** 加载 / 成功 / 空 / 失败 */
    loadingTitle: 'AI 正在识别文案/链接中的地点…',
    loadingDesc: '通常需要 3-8 秒',
    successTitlePre: '识别到',
    successTitlePost: '个地点，请确认',
    successDesc: 'AI 解析结果仅供参考，可修改名称、类型，或删除不想要的地点',
    repaste: '重新粘贴',
    manualTitle: '手动添加地点',
    manualNamePlaceholder: '输入地点名称，如：鹤鸣茶社',
    manualAdd: '添加',
    manualNameTooShort: '请输入至少 2 个字的地点名称',
    manualDuplicate: (name: string) => `“${name}”已在列表中`,
    candDup: '已导入，将跳过',
    candEmpty: '列表为空，请手动添加地点',
    renameEmpty: '地点名称不能为空',
    confirmCount: (count: number) => `确认添加 ${count} 个地点`,
    confirmNote: '确认后进入地点列表，可继续勾选和生成路线',
    toastAdded: (name: string) => `已加入当前路线：“${name}”`,
    toastFavAll: (added: number, skipped: number) =>
      `已加入 ${added} 个收藏地点${skipped > 0 ? `，${skipped} 个已跳过` : ''}`,
    toastFavAllAlready: '全部收藏地点都已在当前路线中',
    toastFavNone: '当前城市还没有收藏地点',
    emptyTitle: '没有识别到地点',
    emptyDesc: '文案里可能没有具体店名或景点名。你可以换一段文案，或手动添加。',
    emptyChange: '换一段文案',
    emptyManual: '手动添加地点',
    errorTitle: 'AI 提取失败',
    errorDesc: '识别服务响应超时，你粘贴的内容已保留，请重试或改为手动添加。',
    errorRetry: '重试',
    errorManual: '手动添加',
    /** 右栏小贴士 */
    asideTitle: '导入小贴士',
    asideTips: [
      `一次可粘贴多篇笔记的文案，最多 ${BUSINESS.MAX_IMPORT_TEXT_LENGTH} 字`,
      '同名地点会自动去重',
      '只识别当前城市内的地点，跨城地点请新建路线',
      'AI 可能识别错误，确认前请核对店名',
      '「当前城市的收藏地点和美食」来自我的收藏，可一键加入本路线，重复加入会自动跳过',
    ],
    asideImportedPre: '当前路线已加入',
    asideImportedPost: '个地点',
    asideGo: '下一步去勾选',
    /** 无权限 */
    deniedTitle: '无法向这条路线添加地点',
    deniedDesc: '路线不存在、不属于当前账号，或尚未选择城市。',
    deniedGo: '去选择城市',
  },
  /** M201 U07 勾选地点（第 4 步）：页头、筛选、路线设置、示意地图、状态块、无权限（按原型原文） */
  ROUTE_PLACES: {
    titleSuffix: '· 已导入地点',
    noCity: '未指定城市',
    /** 无地点时的副标题（原型默认文案） */
    subtitle: '勾选这次想去的地点，系统会按顺路顺序排好',
    sum: (total: number, checked: number, spot: number, food: number) =>
      `共 ${total} 个地点，已勾选 ${checked} 个（景点 ${spot} · 美食 ${food}）`,
    continueAdd: '继续导入 / 添加',
    checkAll: '全选',
    checkNone: '全不选',
    tabAll: '全部',
    filterEmpty: '该分类下暂无地点',
    noAddress: '待定位',
    /** 路线设置（本页只读展示） */
    settingsTitle: '路线设置',
    daysLabel: '行程天数',
    single: '单日',
    many: '多日',
    daysUnitPre: '共几天',
    daysMinus: '减少一天',
    daysPlus: '增加一天',
    daysNote: '多日先把全部地点排成一条顺路顺序，再平均分到每天；排序按真实路况就近且不绕路',
    limitNote: (perDay: number) =>
      `单日最多 ${perDay} 个地点，单条路线最多 ${BUSINESS.MAX_PLACES_PER_ROUTE} 个地点`,
    transportLabel: '交通方式（整条路线统一）',
    /** 起点选择（默认从离住宿最近的景点 / 美食出发） */
    startLabel: '起点',
    startAuto: '不指定（按就近不绕路自动排序）',
    startFromLodging: (name: string) => `从离「${name}」最近的地点出发`,
    startFrom: (name: string) => `从「${name}」出发`,
    startNote: '默认从离住宿最近的地点出发；不想从住宿出发，可在上面自行指定起点',
    generate: '生成路线',
    generateCount: (count: number) => `用 ${count} 个地点生成路线`,
    dayMinPlaces: (days: number) =>
      `每天至少安排 1 个地点：${days} 天需勾选至少 ${days} 个地点`,
    /** 生成中的遮罩 */
    genMaskDesc: '正在按高德真实路况排顺序（就近且不绕路）',
    /** 移除确认 */
    toastRemoved: (name: string) => `已移除“${name}”`,
    delTitle: '从这条路线移除地点？',
    delPre: '将移除“',
    delPost: '”。如需再加入，可在导入页重新添加。',
    delCancel: '取消',
    delConfirm: '移除',
    /** 生成失败 */
    errorTitle: '路线生成失败',
    errorDesc: '部分地点无法规划当前出行方式的路径（如距离过远），请减少地点或切换交通方式后重试',
    errorBack: '返回调整',
    /** 空态 */
    emptyTitle: '还没有导入任何地点',
    emptyDesc: '粘贴小红书笔记文案，或抖音的文案与链接，AI 帮你把地点找出来',
    emptyGo: '去导入地点',
    /** 无权限 */
    deniedTitle: '无法查看这条路线的地点',
    deniedDesc: '路线不存在或不属于当前账号',
    deniedCreate: '新建路线',
  },
  /** M202 U08 调整路线（第 5 步）：页头、出行设置（只读）、按天顺序、市内交通、保存、状态块（按原型原文） */
  ROUTE_EDIT: {
    banner: '路线已按顺路顺序生成，可用上下按钮微调',
    adjTag: '已手动调整',
    editPlaces: '增减地点',
    regen: '重新生成',
    /** 出行设置（本页只读，修改入口见 M202.editSettings） */
    settingsTitle: '出行设置（出发城市 / 城际交通 / 终点住宿）',
    editSettings: '修改这些设置',
    originLabel: '出发城市',
    originNone: '未填写',
    intercityLabel: '城际交通 · 去程',
    intercitySame: '同城出发，无需城际交通',
    intercityNone: '暂不设置',
    intercityRoute: (mode: string, origin: string, dest: string) => `${mode}（${origin} → ${dest}）`,
    lodgingLabel: '终点城市住宿',
    lodgingNone: '暂不预订',
    lodgingValue: (type: string, area: string | null, nights: number | null) =>
      `${type}${area ? ` · ${area}` : ''}${nights ? ` · ${nights} 晚` : ''}`,
    settingsNote: '出发城市、城际交通与住宿未接入真实票务或住宿服务。',
    routeMeta: (city: string, daysPart: string, count: number, mode: string) =>
      `${city} · ${daysPart} · ${count} 个地点 · ${mode}`,
    daysPartMany: (days: number) => `${days} 天（按天分组）`,
    daysPartSingle: '单日',
    /** 按天列表 */
    dayLabel: (day: number) => `第 ${day} 天`,
    dayAll: '全天',
    dayMeta: (count: number, km: string, min: string) => `${count} 个地点 · ${km} 公里 · 约 ${min}`,
    legMeta: (km: string, min: string) => `${km} 公里 · 约 ${min}`,
    moveDayAria: '移到其他天',
    moveDayOption: (day: number) => `第${day}天`,
    moveUp: '上移',
    moveDown: '下移',
    movedToDay: (day: number) => `已移到第 ${day} 天末尾`,
    minOneKeepDay: '每天至少保留 1 个地点',
    /** 市内交通与汇总 */
    transportTitle: '市内交通',
    transportNote: '旅行城市内统一使用一种方式，与上方的城际交通不同',
    totalKmLabel: '总距离',
    totalMinLabel: '在路上',
    estimateNote: '估算值，不含游玩和用餐时间；真实版本以高德路径规划结果为准',
    done: '完成，查看路线图',
    save: '保存路线',
    saveOk: '顺序已保存',
    reorderNote: '第一版用上下按钮调整顺序，不支持拖拽',
    /** 重新生成确认 */
    regenTitle: '重新生成路线？',
    regenDesc: '系统会按当前勾选的地点和天数重新排顺路顺序，你手动调整过的顺序将被覆盖。',
    regenCancel: '取消',
    regenConfirm: '重新生成',
    regenDone: '已重新生成顺路路线',
    /** 空态 */
    emptyTitle: '还没有生成路线',
    emptyDesc: '先在地点列表勾选至少 2 个地点，再点击“生成路线”',
    emptyGo: '去勾选地点',
    /** 无权限 */
    deniedTitle: '无权编辑这条路线',
    deniedDesc: '该路线属于其他账号，或链接已失效',
    deniedBack: '返回我的路线',
  },
  /** M260 U09 路线结果（第 6 步）：工具条、行程信息条、按天顺序、示意地图、状态块（按原型原文） */
  ROUTE_RESULT: {
    /** 工具条 */
    backAria: '返回编辑',
    savedBadge: (date: string) => `已保存 · ${date}`,
    draftBadge: '未保存草稿',
    adjust: '调整',
    shotMode: '截图模式',
    exitShotMode: '退出截图模式',
    save: '保存路线',
    savedBanner: '路线已保存，可在“我的路线”中随时查看',
    savedBannerGo: '去查看',
    /** 卡片头 */
    legendSpot: '景点',
    legendFood: '美食',
    legendLodging: '住宿',
    metaDays: (days: number) => `${days} 天`,
    metaSingle: '单日',
    metaCount: (count: number) => `${count} 个地点`,
    noCity: '未指定城市',
    duration: (minutes: number) =>
      minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${minutes} 分钟`,
    /** 行程信息条 */
    originLabel: '出发城市',
    originNone: '未填写',
    intercityLabel: '城际交通',
    intercityNone: '暂不设置',
    intercitySame: '同城出发，无需城际交通',
    intercityRoute: (mode: string, origin: string, dest: string) => `${mode} · ${origin}→${dest}`,
    lodgingLabel: '住宿',
    lodgingNone: '暂不预订',
    tripNote: '出发城市、城际交通与住宿未接入真实票务或住宿服务。',
    /** 按天顺序 */
    allDays: '多日行程',
    dayLabel: (day: number) => `第 ${day} 天`,
    /** 整条路线只有一天时，不再写「第 1 天」，直接写「单日行程」 */
    singleDayLabel: '单日行程',
    dayMeta: (km: string, min: string) => `${km} 公里 · 约 ${min}`,
    typeSpot: '景点',
    typeFood: '美食',
    noAddress: '待定位',
    legMeta: (mode: string, km: string, min: string) => `${mode} · 约 ${min} · ${km} 公里`,
    /** 交给手机高德导航（每天右上角按钮） */
    amapNav: '手机高德导航',
    amapNavTitle: '用手机高德地图导航这一天（含最后返回住宿）',
    amapNavHint: '手机上点当天右侧「手机高德导航」，即可把当天的路线，交给手机高德直接导航',
    amapNavNoOpen:
      '没能唤起高德地图 App：请确认手机已装高德地图，并用系统浏览器（Safari / Chrome）打开本页；微信、QQ 内置浏览器会拦截跳转',
    amapNavFailed: '这一天的地点缺少坐标，暂时无法交给高德导航',
    /** 「手机高德导航」为会员功能（游客 / 正常用户按钮显示锁定态） */
    amapNavLocked: '会员可用',
    amapNavLockedTitle: '「手机高德导航」为会员功能，升级会员后可用',
    /** 点击锁定态按钮弹出的升级引导 */
    upgradeNavTitle: '升级会员解锁「手机高德导航」',
    upgradeNavDesc: '「手机高德导航」与更多路线权益为会员专享，前往个人中心升级为会员后即可使用。',
    upgradeNavGo: '去升级会员',
    upgradeNavCancel: '暂不升级',
    /** 周边知名地点：默认不查，点某天的按钮才查该天（省高德配额） */
    landmarkShow: '查看周边知名地点',
    landmarkLoading: '查询中…',
    landmarkQuotaTip: '高德本月额度紧张，周边知名地点暂时无法显示',
    /** 导航方式切换（U09）：切换后按该方式重排当天顺序并重算路段 */
    navTitle: '出行方式',
    navHint: '切换出行方式后，当天地点会按该方式重新排顺序，路段距离与时间同步重算',
    navLoading: '正在按该方式重算路线…',
    navEstimate: '高德这段没算出路线，已按直线距离估算',
    /** 回住宿（U09）：当天走完可选交通方式回住宿地点 */
    returnTitle: '回住宿方式',
    returnHint: '当天走完点上方方式，即可按该方式算出回住宿的真实路线',
    returnLeg: (name: string, km: string, min: string) => `返回 ${name} · ${km} 公里 · ${min}`,
    returnLegLoading: '正在算回住宿路线…',
    returnLegFailed: '这段回住宿没算出路线，稍后重试',
    /** 出发点：当天第 1 行就是出发点、序号固定为 0；默认是住宿所在地点（名称右侧标「住」），不想从住宿出发可自行改 */
    lodgingBadge: '住',
    lodgingHint: '这里是住宿位置',
    startHint: '这里是当天的出发点，不占序号',
    startChange: '修改出发点',
    startChangeTitle: (count: number) => `选一个地点作为当天的出发点（可选 ${count} 个）`,
    /** 「修改出发点」面板底部的退回入口：把出发点改回默认的住宿 */
    startBack: '改回从住宿出发',
    /** 顺序调整 */
    orderTitle: '调整顺序',
    orderHint: '拖动左侧序号，或用箭头上下移动；点「移号」按钮可直接跳到指定名次',
    orderMove: '移动到指定名次',
    /** 行内按钮可见文案：写清这是「移动 / 改序号」，不用「⋯」这种含糊图标 */
    orderMoveBtn: '移号',
    orderUp: '上移一位',
    orderDown: '下移一位',
    orderDrag: '拖动调整顺序',
    /** T-026 移除已选地点：行内按钮（与上移/下移/移号同组）+ 结果提示，游客与会员结果页共用 */
    orderRemove: '移除该地点',
    removeBtn: '移除',
    removeMin: '至少保留 2 个地点，不能再移除了',
    removeLastOfDay: '每天至少保留 1 个地点，不能把这一天移空',
    removeDone: '已移除，里程与时间已按剩余地点重算',
    removeFailed: '移除失败，已恢复原来的列表，请稍后再试',
    /** T-027：复位覆盖移除——快照保留首次系统推荐，复位失败时的提示（成功复用 TRY.RESULT.resetDone） */
    resetFailed: '复位失败，已恢复当前列表，请稍后再试',
    /** T-027：结果页地图全屏 */
    fsEnter: '全屏',
    fsExit: '退出全屏',
    fsEnterAria: '地图全屏',
    fsExitAria: '退出地图全屏',
    orderSaved: '顺序已保存',
    orderSaving: '保存顺序中…',
    orderFailed: '保存失败，已保留原顺序，请稍后重试',
    moveToTitle: (count: number) => `移动到第几位（共 ${count} 位）`,
    moveToCancel: '取消',
    /** 缩略图：没有照片时用色块 + 首字 */
    thumbAlt: (name: string) => `${name} 图片`,
    /** 地图 */
    mapNote: '底图与标记由高德地图提供',
    zoomIn: '放大',
    zoomOut: '缩小',
    /** 底部汇总 */
    total: (km: string, min: string) => `全程约 ${km} 公里 · 在路上约 ${min}`,
    totalPlaces: (count: number) => `共 ${count} 个地点`,
    generatedAt: '生成于',
    /** 截图模式提示 */
    shotTip: '请使用系统截图（手机：电源键+音量键；电脑：Win+Shift+S / Cmd+Shift+4）保存这张图',
    /** 空态 */
    emptyTitle: '这条路线还没有地点',
    emptyDesc: '去导入并勾选地点后再生成路线',
    emptyGo: '去勾选地点',
    /** 无权限 */
    deniedTitle: '这条路线仅创建者可见',
    deniedDesc: '第一版不支持公开分享链接，请让对方截图发给你',
    deniedBack: '返回首页',
  },
  /** M261 U10 个人中心：账号信息、统计四宫格、会员卡、菜单（按原型原文） */
  PROFILE: {
    memberBadgeAdmin: '最高级会员',
    memberBadge: '会员用户',
    memberBadgeNone: '普通用户',
    memberSince: (date: string) => `开通于 ${date}`,
    registeredAt: (date: string) => `注册于 ${date}`,
    /** 统计四宫格 */
    statRoutes: '已保存路线',
    statCollected: '收藏地点',
    statPlaces: '导入地点',
    statCities: '去过城市',
    /** 会员卡（会员身份）：展示会员档规则 */
    memberOnTitle: '你已成为会员用户',
    memberOnDesc: (benefits: string) => `已享受会员权益：${benefits}。`,
    /** 管理员权益卡：管理员 = 最高级会员，配额不限 */
    adminOnTitle: '你当前是管理员（最高级会员）',
    adminOnDesc: (benefits: string) => `已享受管理员权益：${benefits}。`,
    memberOnMeta: (since: string, source: string) => `开通于 ${since} · ${source}`,
    /** 会员有效期（阶段 3 付费开通）：member_until 为 null 即永久会员 */
    memberForever: '永久有效',
    memberUntil: (date: string) => `有效期至 ${date}`,
    sourceUnknown: '来源未知',
    /** 正常用户卡（普通用户身份）：按自己档位展示规则，右侧仍保留升级入口 */
    upgradeTag: '正常版权益',
    upgradeTitle: '你当前是正常版，升级会员解锁更强的路线规划',
    upgradeBtn: '升级为会员',
    upgradeNoteReal: '点击后进入支付流程',
    upgradeNoteMock: '模拟流程：点击后仅模拟支付成功，第一版不真实收费、未接入真实支付',
    modalTitle: '升级为会员（模拟）',
    modalDesc: (benefits: string) =>
      `模拟支付成功后，你的身份将变为「会员用户」，可享受${benefits}。`,
    modalNote:
      '本页不接入真实支付，点击「模拟支付成功」不会产生任何扣费，仅用于演示会员状态；管理员也可在后台为你开通会员。',
    cancel: '取消',
    confirmUpgrade: '模拟支付成功',
    processing: '处理中…',
    /** 菜单 */
    menuRoutes: '我的路线',
    menuCollected: '我的收藏地点',
    menuNewRoute: '新建路线',
    collectedNewTag: '本期新增',
    menuFeedback: '意见反馈',
    feedbackEmail: 'help@yitiaoxian.cn',
    menuLogout: '退出登录',
    logoutTitle: '确定退出登录？',
    logoutDesc: '已保存的路线不会丢失，下次登录即可查看。',
    logoutConfirm: '退出',
  },
  /** M262 U11 我的收藏地点（本期新增）：页头、筛选、卡片、状态块、加入路线弹层（按原型原文） */
  COLLECTED: {
    backAria: '返回首页',
    title: '我的收藏地点',
    desc: '先从笔记文案（小红书）或分享链接里收藏地点，再挑选加入路线。收藏库保存在你的账号下。',
    filterAll: '全部',
    searchPlaceholder: '搜索名称、城市、地址或备注',
    importBtn: '导入文案 / 链接',
    sum: (total: number, spot: number, food: number) =>
      `共 ${total} 个收藏 · 景点 ${spot} · 美食 ${food}`,
    /** 按城市分组（点击城市名折叠 / 展开） */
    groupHint: '已按城市分组，点击城市名可折叠 / 展开',
    groupCount: (n: number) => `${n} 个`,
    groupToggleAria: (city: string, expanded: boolean) =>
      `${expanded ? '收起' : '展开'}${city}的收藏`,
    noCity: '未指定城市',
    noAddress: '待定位',
    manualSource: '手动添加',
    note: (note: string, time: string) => `备注：${note} · 收藏于 ${time}`,
    noteEmpty: '—',
    addToRoute: '加入路线',
    inRoute: '已在路线中',
    remove: '移除收藏',
    /** 筛选空态 */
    emptyFilterTitle: '没有符合条件的地点',
    emptyFilterDesc: '换个关键词，或切回“全部”看看。',
    resetFilter: '重置筛选',
    /** 列表空态 */
    emptyTitle: '还没有收藏地点，去导入文案',
    emptyDesc: '粘贴小红书笔记文案，或抖音的文案与链接，AI 提取地点后就能存进收藏库，暂时不用建路线。',
    emptyImport: '去导入文案',
    emptyNewRoute: '直接新建路线',
    /** 加载失败 */
    errorTitle: '收藏地点加载失败',
    errorDesc: '网络异常，请稍后重试；已收藏的地点仍会保留，可重新加载。',
    errorRetry: '重试加载',
    errorReimport: '重新导入',
    /** 加入路线弹层 */
    modalTitle: '加入路线',
    modalDesc: (name: string) => `将「${name}」加入所选路线的地点库，随后可在“勾选地点”里确认。`,
    modalCancel: '取消',
    modalConfirm: '确认加入',
    modalNoRoutes: '你还没有路线。需要先去选城市并新建路线，再把收藏的地点加入。',
    modalGoNewRoute: '去新建路线',
    /** 轻提示 */
    toastRemoveFail: '移除失败，请重试',
    toastRemoved: (name: string) => `已移除收藏“${name}”`,
    toastAdded: (name: string) => `“${name}”已加入路线，可在勾选地点里确认`,
    toastAddFail: '加入失败，请重试',
  },

  /** M330 管理端外壳 / 侧边栏（A02-A07）：品牌、导航、只读提示、退出后台、顶栏（按原型原文） */
  ADMIN_SHELL: {
    brandName: '一条线后台',
    brandSub: '只读模式',
    navOverview: '概览',
    navUsers: '用户列表',
    navOnline: '在线用户',
    navPlaces: '地点列表',
    navRoutes: '路线列表',
    navImports: '导入记录',
    navOrders: '会员订单',
    navSettings: '设置',
    navTechStack: '技术栈',
    readOnlyNote: '后台不提供编辑 / 删除 / 踢出',
    logout: '退出后台',
    browsingAs: '运营管理员',
    operatorInitial: '管',
    badgeReadonly: '只读',
    badgeUsers: '只读 · 会员操作除外',
    badgeOrders: '待核销置顶 · 支持核销',
    /** 侧栏 / 底栏「会员订单」红色角标的无障碍说明与悬浮提示 */
    pendingOrdersAria: (count: number) => `待核销会员订单 ${count} 单`,
  },
  /** M331 管理端顶栏文案（A02-A07）：更新时间、自动刷新、刷新、面包屑根（按原型原文） */
  ADMIN_HEADER: {
    updatedAt: '数据更新于',
    updatedAtPlaceholder: '--:--:--',
    autoRefresh: (seconds: number) => `每 ${seconds} 秒自动刷新`,
    refresh: '刷新',
    refreshed: '数据已刷新',
    menuAria: '打开菜单',
  },
  /** M332 A01 管理员登录：标题、表单、校验中、脚注（按原型原文） */
  ADMIN_LOGIN_PAGE: {
    title: '管理员登录',
    desc: '仅限 role = admin 的账号访问',
    emailLabel: '管理员邮箱',
    emailPlaceholder: 'admin@yitiaoxian.cn',
    emailRequired: '请输入管理员邮箱',
    emailInvalid: '邮箱格式不正确',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入密码',
    passwordRequired: '请输入密码',
    submit: '登录',
    verifying: '正在验证管理员身份…',
    success: '登录成功，正在进入概览…',
    deniedTitle: '无权限访问管理后台',
    deniedLead: '账号',
    deniedTail: '不是管理员。如需开通，请联系产品负责人。',
    deniedSwitch: '换个账号登录',
    siteSub: '管理后台 · 只读',
    footerNote: '后台仅提供只读查看，不支持编辑、删除或踢出用户',
  },
  /** M333 管理端公共状态块：失败重试（A02-A07 复用，按原型原文） */
  ADMIN_COMMON: {
    retry: '重试',
  },
  /** M334 A02 管理员概览：约束说明、六张统计卡、快捷入口、空/失败状态（按原型原文） */
  ADMIN_OVERVIEW: {
    constraintLead:
      '约束变更：原 PRD 规定“管理员后台只读，不做编辑 / 删除 / 踢出用户”。本版本唯一例外是在',
    constraintLink: 'A03 用户列表',
    constraintTail:
      '“管理员操作（会员）”列开通 / 取消会员身份，其余能力仍为只读，该变更需产品确认后进入编码。',
    statOnline: '当前在线',
    statOnlineHint: (minutes: number) => `最近 ${minutes} 分钟有心跳`,
    live: '实时',
    statUsers: '总用户数',
    statUsersHint: (today: number, members: number) => `今日新增 +${today} · 会员 ${members}`,
    statMembers: '会员用户',
    statMembersHint: (rate: number) => `占比 ${rate}% · 管理员可开通 / 取消`,
    statPlaces: '总地点数',
    statPlacesHint: (spot: number, food: number) => `景点 ${spot} · 美食 ${food}`,
    statRoutes: '总路线数',
    statRoutesHint: (saved: number) => `已保存 ${saved}`,
    statImports: '导入记录',
    statImportsHint: (rate: number) => `成功率 ${rate}%`,
    quickTitle: '快捷入口',
    quickUsers: '用户列表',
    quickMembers: '会员用户（在用户列表中开通 / 取消）',
    quickOnline: '在线用户',
    quickPlaces: '地点列表',
    quickRoutes: '路线列表',
    quickImports: '导入记录',
    metricsTitle: 'MVP 成功指标（埋点模拟）',
    metricsRange: '近 7 天',
    metricAddPlace: '添加地点数',
    metricGenRoute: '生成路线数',
    metricUpgradeClick: '升级付费点击',
    metricEvent: (name: string) => `事件 ${name}`,
    metricBars: '每日生成路线数',
    /** M334b 本月高德用量卡片（Q01-Q04：每个 Key 15 万次/月，80% 黄色 / 95% 红色预警；多 Key 叠加时合计翻倍） */
    usageTitle: '本月高德用量',
    usageMonth: (used: number, quota: number) => `本月已用 ${used} / ${quota}`,
    usagePercent: (percent: number) => `占月配额 ${percent}%`,
    usageToday: (calls: number) => `今日 ${calls} 次`,
    usageServiceTitle: '各服务明细（本月）',
    usageServiceRow: (service: string, calls: number) => `${service} · ${calls} 次`,
    usageServiceFailures: (failures: number) => `失败 ${failures}`,
    usageKeyTitle: (count: number) => `各账号 Key 用量（本月，共 ${count} 个 Key）`,
    usageKeyRow: (label: string, calls: number, percent: number) => `${label} · ${calls} 次（${percent}%）`,
    usageKeyExhausted: '已用满，暂时跳过',
    usageKeyWarn: '接近上限',
    usageWarn: (percent: number) => `用量已达 ${percent}%，接近月配额上限，请留意`,
    usageCritical: (percent: number) =>
      `用量已达 ${percent}%，已进入配额保护模式（部分高德调用被降级）`,
    usageEmpty: '本月暂无高德调用记录',
    usageUnavailable: '用量数据暂时无法获取',
    /** T-048 本月图片 OCR 识别用量卡片（额度 BUSINESS.OCR_MONTHLY_QUOTA，数据源 user_daily_usage kind='ocr'） */
    ocrUsageTitle: '本月图片 OCR 识别用量',
    ocrUsageMonth: (used: number, quota: number) => `本月已用 ${used} / ${quota}`,
    ocrUsageRemain: (remain: number) => `剩余 ${remain} 次`,
    ocrUsageEmpty: '本月暂无图片 OCR 识别记录',
    emptyTitle: '暂无数据',
    emptyDesc: '产品上线后，用户、地点、路线和导入数据会显示在这里',
    errorTitle: '概览数据加载失败',
    errorDesc: '统计接口超时，请稍后重试',
  },
  /** M334c T-049 管理端设置页：分组、字段、开关、保存反馈（按任务卡字段表） */
  ADMIN_SETTINGS: {
    title: '设置',
    badge: '全局生效 · 仅管理员可改',
    notice: '保存后立即生效；个别数字下次请求生效（服务端有 30 秒缓存）。',
    riskNotice: '业务开关会立即改变线上行为（下单 / 识别 / 导入接口直接返回 403），修改前请确认影响范围。',
    groupAi: 'AI 模型',
    groupFlags: '业务开关',
    groupQuotas: '配额数字',
    // T-057：主/备双模型卡（可替换模型 + 备用自动兜底 + Key 后台录入）
    cardPrimary: '主模型',
    cardFallback: '备用模型',
    fieldProviderLabel: '显示名称',
    fieldProviderLabelHint: '如 DeepSeek / 通义千问',
    fieldLlmBaseUrl: 'Base URL（API 地址，https）',
    fieldLlmModel: '模型名',
    fieldLlmApiKey: 'API Key',
    fieldLlmEnabled: '启用',
    apiKeySaved: (mask: string) => `已保存：${mask}（留空保持不变）`,
    apiKeyNone: '未设置（留空则回落环境变量 DEEPSEEK_API_KEY）',
    apiKeyClear: '清除 Key（回落环境变量）',
    fallbackAdd: '+ 添加备用模型',
    fallbackClear: '清除备用',
    fallbackNoneHint: '主模型失败时自动切换到备用模型重试一次；当前未配置备用模型。',
    testBtn: '测试连接',
    testing: '测试中…',
    testOk: (ms: number) => `连接成功 · ${ms}ms`,
    testErr: (msg: string) => `连接失败：${msg}`,
    errTest: '测试连接请求失败，请稍后重试',
    errFallbackMissing: '备用模型未配置',
    errMissingKey: '缺少 API Key（后台未录入且环境变量为空）',
    // T-053：OCR 接口下拉
    fieldOcrAction: 'OCR 接口',
    ocrActionBasic: '通用印刷体识别（GeneralBasicOCR）',
    ocrActionAccurate: '高精度版识别（GeneralAccurateOCR）',
    fieldOcrRegion: 'OCR 地域',
    fieldOcrMonthlyQuota: 'OCR 月额度（全站每月总次数）',
    fieldBilling: '开放付费',
    // T-051：三个开关说明统一「接口 403 + 前端提示」口径
    fieldBillingHint: '关闭后下单接口返回 403，收银台提示「暂停购买」',
    fieldOcr: '图片识别',
    fieldOcrHint: '关闭后图片识别接口返回 403，首页/导入面板的图片识别入口提示「已暂停」',
    fieldImport: '导入地点',
    fieldImportHint: '关闭后导入接口返回 403，首页导入面板提示「已暂停」并禁用入口',
    fieldFreePlacesPerDay: '正常用户单日地点数',
    fieldMemberPlacesPerDay: '会员单日地点数',
    fieldMemberMonthlyRoutes: '会员每月路线数',
    fieldFreeAiExtract: 'AI 提取 · 正常用户（次/日）',
    fieldMemberAiExtract: 'AI 提取 · 会员（次/日）',
    fieldOcrDailyLimit: 'OCR 每日次数（次/人/日）',
    // T-052：配额数字按身份分三组（小标题含说明）
    quotaGroupFree: '正常用户（注册即可用）',
    quotaGroupMember: '会员用户（付费 / 管理员开通）',
    quotaGroupCommon: '通用（图片识别 OCR，全站与个人限额）',
    // T-050：AI 模型分组顶部的只读摘要（随输入同步，未保存标「待保存」）
    summaryTitle: '当前生效配置',
    summaryExtractLabel: 'AI 提取地点',
    summaryExtractProvider: 'DeepSeek',
    // T-057：摘要改为主/备当前模型两行
    summaryPrimaryLabel: '主模型',
    summaryFallbackLabel: '备用模型',
    summaryFallbackOn: '已启用',
    summaryFallbackOff: '未启用',
    summaryFallbackNone: '未配置',
    summaryOcrLabel: '图片识别',
    summaryOcrProvider: '腾讯云 OCR',
    // T-053：摘要展示「模型 @ Base URL」与 OCR 接口类型，地域单列一行
    summaryOcrRegionLabel: '图片识别地域',
    pendingSave: '待保存',
    // T-052：分模块保存——三个模块各自一个保存按钮（均在卡片标题行右侧），互不影响
    saveAi: '保存 AI 配置',
    saveFlags: '保存开关',
    saveQuotas: '保存配额',
    saving: '正在保存…',
    savedAiToast: 'AI 配置已保存并立即生效',
    savedFlagsToast: '业务开关已保存并立即生效',
    savedQuotasToast: '配额已保存并立即生效',
    errLoad: '设置读取失败，请稍后重试',
    errSave: '设置保存失败，请重试',
  },
  /**
   * M334d T-049 骨架 → T-050 动态化 → T-055 加厚：
   * 内容全部为本项目真实技术栈（仓库实测统计，统计命令见任务卡 T-055），禁止编造。
   * 每个条目三要素：desc=用途 / where=关键位置（文件或迁移号）/ why=为什么选它。
   */
  ADMIN_TECH_STACK: {
    title: '技术栈',
    badge: '真实技术栈 · 一页总览',
    notice: '一页总览：统计 · 架构链路 · 六层技术栈 · 关键目录 · 自检命令；条目可点击展开补充说明。',
    statsLabel: '仓库实测',
    /** T-056 一页铺开：各分区标题（tab 取消） */
    sections: {
      chain: '架构链路',
      layers: '技术栈六层',
      dirs: '关键目录',
      cmds: '自检命令',
    },
    stats: [
      { value: 82, label: '单元测试用例' },
      { value: 8, label: '端到端用例' },
      { value: 32, label: 'API 接口' },
      { value: 32, label: '数据库迁移' },
      { value: 15, label: '数据表' },
      { value: 25, label: '页面' },
    ],

    layers: [
      {
        name: '前端',
        en: 'FRONTEND',
        summary: '用户端与后台界面全部由 Next.js App Router 渲染，无独立前端工程',
        items: [
          {
            name: 'Next.js 14',
            badge: 'App Router',
            desc: '全栈框架：页面 + API 同仓同进程（14.2.15）',
            where: 'app/（25 个 page.tsx）',
            why: '文件式路由，Route Handler 与页面共用一套构建部署',
          },
          {
            name: 'React 18',
            badge: '18.3.1',
            desc: '交互组件运行时（客户端组件以 use client 标记）',
            where: 'components/（48 个 .tsx）',
            why: 'Next 14 内置版本，生态兼容最稳',
          },
          {
            name: 'TypeScript',
            badge: 'strict',
            desc: '全仓严格类型检查，typecheck 0 报错是验收门禁',
            where: 'tsconfig.json（npm run typecheck）',
            why: '编译期拦截类型回归，避免线上低级错误',
          },
          {
            name: 'TailwindCSS 3',
            badge: 'v3',
            desc: '原子化样式；主色渐变 primary-from→primary-to（玫红→紫）',
            where: 'tailwind.config.ts + config/product.ts',
            why: '产品色值集中在 config/product.ts，全仓禁止写死颜色',
          },
          {
            name: 'lucide-react',
            badge: 'icons',
            desc: '全站图标库（线性图标风格统一）',
            where: 'components/ 各处引用',
            why: '按需摇树、体积可控、与 Tailwind 尺寸体系契合',
          },
          {
            name: 'Canvas 出图',
            badge: 'poster',
            desc: '路线海报长图导出',
            where: 'lib/route-poster.ts',
            why: '浏览器端绘制出图，无需服务端渲染成本',
          },
        ],
      },
      {
        name: '服务端',
        en: 'SERVER',
        summary: 'API 与页面同仓：Route Handlers 服务端直连 Supabase，鉴权/限流/校验在入口完成',
        items: [
          {
            name: 'Route Handlers',
            badge: '32 个接口',
            desc: '全部业务接口：鉴权 / 配额 / 算路 / 导入 / 后台',
            where: 'app/api/**/route.ts（12 个域分组）',
            why: '与页面同进程部署，无独立后端服务',
          },
          {
            name: 'middleware 路由守卫',
            badge: 'Edge',
            desc: '登录态校验、后台路径拦截在页面渲染前完成',
            where: 'middleware.ts + lib/supabase/middleware.ts',
            why: '@supabase/ssr 官方模式，未授权请求到不了业务代码',
          },
          {
            name: '手写参数校验',
            badge: '纯函数',
            desc: '设置项范围校验（validateSettingsPatch 等）',
            where: 'lib/app-settings.ts',
            why: '校验规则简单明确，不为此引入校验库',
          },
          {
            name: 'Cookie 会话',
            badge: '@supabase/ssr',
            desc: '登录态存 httpOnly cookie，服务端直读',
            where: 'lib/supabase/{client,server,admin}.ts',
            why: '与 GoTrue 原生衔接，SSR 无需前端透传 token',
          },
          {
            name: '游客限流分桶',
            badge: '按接口成本',
            desc: '免登录按外部 API 成本分桶：花钱桶 3 次/日、只读桶 100 次/日、重排 60 次/日',
            where: 'lib/guest-rate-limit.ts',
            why: '防止免登录流量刷爆高德/DeepSeek 配额',
          },
          {
            name: '并发守卫 RPC',
            badge: '迁移 033',
            desc: '下单 / 建路线在单事务内 pg_advisory_xact_lock 原子完成（配额与写入同事务）',
            where: 'supabase/migrations/033_concurrency_guards.sql',
            why: '消除「先查后写」竞态，并发不超卖',
          },
        ],
      },
      {
        name: '数据',
        en: 'DATA',
        summary: '自建 Supabase（Postgres 全家桶），15 张业务表，RLS 在库层保护用户数据',
        items: [
          {
            name: 'PostgreSQL',
            badge: '自建 Supabase',
            desc: '主数据存储（15 张业务表：用户/地点/路线/订单/用量等）',
            where: 'supabase/migrations/（001–033，32 份）',
            why: '数据境内自持，可控且迁移改动量小',
          },
          {
            name: 'PostgREST',
            badge: 'REST 层',
            desc: '表自动暴露为 REST 接口，应用侧免写 CRUD',
            where: 'lib/supabase/server.ts',
            why: 'RLS 在 REST 层强制执行，应用代码拿不到越权数据',
          },
          {
            name: 'GoTrue（Auth）',
            badge: 'Auth',
            desc: '邮箱注册 / 登录 / 管理员 API',
            where: 'app/api/auth/（4 个接口）',
            why: 'Supabase 原生鉴权，与 Cookie 会话无缝衔接',
          },
          {
            name: 'RLS 行级安全',
            badge: '迁移 009/013/021',
            desc: '用户数据按行隔离，仅本人（或管理员）可读写',
            where: '009_rls_policies.sql 等',
            why: '安全边界放在数据库层，不依赖应用代码正确性',
          },
          {
            name: 'pg_cron 定时任务',
            badge: '迁移 026',
            desc: '会员到期自动降级',
            where: '026_member_expire_cron.sql',
            why: '库内调度，无需外部定时服务',
          },
          {
            name: '原子 RPC',
            badge: '迁移 027/033',
            desc: '单事务替换路线地点、审核通过、下单与建路线守卫',
            where: '027_atomic_replace_and_approve.sql',
            why: '多步写操作要么全成要么全败，杜绝中间态',
          },
        ],
      },
      {
        name: '地图与算路',
        en: 'MAP & ROUTING',
        summary: '高德开放平台双端：JS API 前端渲染 + Web 服务后端算路，Key 池与缓存控额',
        items: [
          {
            name: '高德 JS API',
            badge: '前端渲染',
            desc: '地图 / 折线 / 标记点渲染（interactive 参数控制可操作）',
            where: 'lib/amap-loader.ts + components/map/AmapMap.tsx',
            why: '国内地图覆盖与定位体验最佳，官方 SDK 功能完整',
          },
          {
            name: '高德 Web 服务',
            badge: 'Key 池',
            desc: '距离矩阵与地理编码（服务端调用）',
            where: 'lib/amap.ts + lib/amap-key-pool.ts',
            why: '多 Key 轮询分摊配额，避免单 Key 被限流',
          },
          {
            name: '距离矩阵缓存',
            badge: '落库复用',
            desc: '算路结果与地理编码落库，相同点对不再重复计费',
            where: 'amap_leg_cache / amap_geocode_cache 表',
            why: '外部调用按次计费，缓存直接省成本',
          },
          {
            name: '用量记账',
            badge: 'amap_usage',
            desc: '每次调用按 Key 记账，配合配额控制',
            where: 'lib/amap-usage.ts',
            why: '消耗可追溯，超额可提前发现',
          },
          {
            name: '最近邻 + 2-opt',
            badge: '纯函数算法',
            desc: '地点顺序优化（先最近邻构造，再 2-opt 改进）',
            where: 'lib/route-order.ts',
            why: '不依赖算法服务，可单测、结果可解释',
          },
        ],
      },
      {
        name: 'AI 与外部服务',
        en: 'AI & EXTERNAL',
        summary: '文案提取、图片识别两条 AI 通道 + 企业微信订单提醒',
        items: [
          {
            name: 'DeepSeek',
            badge: 'LLM',
            desc: '游记/笔记文案 → 结构化地点提取',
            where: 'lib/deepseek.ts + app/api/ai/',
            why: '国内 API、中文提取效果好、按量计费',
          },
          {
            name: '腾讯云 OCR',
            badge: '通用印刷体',
            desc: '攻略截图 → 文字识别后走同一提取链路',
            where: 'lib/tencent-ocr.ts',
            why: '印刷体识别准确率高，用量可控',
          },
          {
            name: '企业微信 Webhook',
            badge: '订单提醒',
            desc: '新订单实时推送到运营群',
            where: 'lib/order-notify.ts',
            why: '团队已在企业微信生态，零额外接入成本',
          },
        ],
      },
      {
        name: '质量与运维',
        en: 'QUALITY & OPS',
        summary: '82 单测 + 8 E2E 基线、真机尺寸审计、自建部署与每日备份',
        items: [
          {
            name: 'vitest',
            badge: '82 条',
            desc: '单元测试基线（配额/限流/算路/OCR/设置等纯逻辑）',
            where: 'tests/unit/（10 个文件）',
            why: '与 Vite 配置共用、启动快，改动必跑',
          },
          {
            name: 'Playwright',
            badge: '8 条',
            desc: '核心链路 E2E（鉴权、主流程冒烟）',
            where: 'tests/e2e/（smoke + core-flows）',
            why: '真实浏览器验证渲染与交互，发布前门禁',
          },
          {
            name: '移动端审计',
            badge: 'audit:mobile',
            desc: '真机尺寸下横向溢出检查',
            where: 'scripts/mobile-audit.mjs',
            why: '目标用户以手机为主，溢出即发布阻塞项',
          },
          {
            name: '环境自检',
            badge: 'check:env',
            desc: '环境变量 / Supabase 连通 / dev 探活一条命令诊断',
            where: 'scripts/check-env.mjs',
            why: '先排环境再查代码，减少误判',
          },
          {
            name: 'Nginx + SSH 隧道',
            badge: '接入层',
            desc: '反向代理接入自建 Supabase',
            where: '自建服务器（运维配置，仓库外）',
            why: '数据库不直接暴露公网',
          },
          {
            name: '每日 pg_dump',
            badge: '备份',
            desc: '数据库每日定时备份',
            where: '服务器 crontab（仓库外）',
            why: '自建服务需自管备份兜底',
          },
        ],
      },
    ],
    /** T-055 新增①：请求链路（浏览器 → Route Handler → Supabase → Postgres + 外部服务） */
    chain: {
      summary: '一次典型业务请求的完整路径；点击节点查看职责与代码位置。',
      nodes: [
        {
          name: '浏览器',
          sub: 'React 页面',
          desc: '用户操作发起 fetch；页面与组件由 App Router 渲染',
          where: 'app/ + components/',
        },
        {
          name: 'Route Handler',
          sub: 'Next.js 服务端',
          desc: '统一入口：middleware 先验会话，接口内做参数校验、游客限流分桶、配额检查',
          where: 'app/api/**/route.ts（32 个）',
        },
        {
          name: 'Supabase 服务层',
          sub: 'PostgREST + GoTrue',
          desc: '数据读写经 PostgREST（RLS 强制执行）；注册登录经 GoTrue',
          where: 'lib/supabase/',
        },
        {
          name: 'PostgreSQL',
          sub: '15 张业务表',
          desc: '行级安全隔离用户数据；多步写操作走单事务 RPC（迁移 027/033）',
          where: 'supabase/migrations/',
        },
      ],
      externalsTitle: '外部服务（由 Route Handler 服务端调用，密钥只在服务端）',
      externals: [
        {
          name: '高德 Web 服务',
          desc: '距离矩阵 / 地理编码：Key 池轮询控额，结果落库缓存',
          where: 'lib/amap.ts + lib/amap-key-pool.ts',
        },
        {
          name: 'DeepSeek',
          desc: '文案 → 结构化地点提取（导入链路）',
          where: 'lib/deepseek.ts',
        },
        {
          name: '腾讯云 OCR',
          desc: '图片 → 文字，识别结果再走提取链路',
          where: 'lib/tencent-ocr.ts',
        },
        {
          name: '企业微信 Webhook',
          desc: '新订单提醒推送运营群',
          where: 'lib/order-notify.ts',
        },
      ],
    },
    /** T-055 新增②：关键目录 */
    dirs: {
      summary: '代码组织按域分组；点击目录查看职责与为什么这样放。',
      items: [
        {
          path: 'app/',
          count: '25 个页面',
          desc: 'App Router 页面：用户端（选城市/行程/路线）、后台 10+ 页、分享页',
          why: '文件式路由，页面与布局同目录树',
        },
        {
          path: 'app/api/',
          count: '32 个接口',
          desc: 'Route Handlers 按域分组：admin / ai / amap / auth / member / places / routes / shares / try（游客）等 12 组',
          why: '接口与页面同仓，部署一个进程',
        },
        {
          path: 'lib/',
          count: '30 个模块',
          desc: '纯业务逻辑与外部服务封装：算路（route-order）、配额（member-quota）、限流（guest-rate-limit）、高德（amap*）、DeepSeek、OCR、海报（route-poster）',
          why: '无 UI 依赖、可单测，被 API 与组件共用',
        },
        {
          path: 'components/',
          count: '48 个组件',
          desc: 'UI 组件按业务域 14 组：admin / auth / city / map / route / share / try（游客）等',
          why: '游客页与登录页共用组件，避免两套实现分叉',
        },
        {
          path: 'supabase/migrations/',
          count: '32 份（001–033）',
          desc: '数据库增量迁移：建表 / RLS 策略 / RPC / pg_cron / 种子数据',
          why: '一切库结构变更走迁移文件，禁止手改库',
        },
        {
          path: 'tests/',
          count: '82 单测 + 8 E2E',
          desc: 'unit/ 纯逻辑测试 10 个文件；e2e/ 真实浏览器 2 个 spec',
          why: 'typecheck + 测试是每次改动的验收门禁',
        },
        {
          path: 'scripts/',
          count: '4 个自检脚本',
          desc: 'check-env / check-schema / check-cities / mobile-audit',
          why: '环境与一致性检查一条命令可复现',
        },
        {
          path: 'config/',
          count: '文案 + 色值',
          desc: 'messages.ts 全站文案集中管理；product.ts 产品色值唯一来源',
          why: '组件禁止写死文案与颜色',
        },
      ],
    },
    /** T-055 新增③：自检命令 */
    cmds: {
      summary: '改动前后按场景执行；点击命令查看用途与执行时机。',
      items: [
        {
          cmd: 'npm run check:env',
          desc: '检查 .env.local 关键变量、Supabase 连通性、dev 服务探活',
          when: '开工前 / 环境或配置变更后',
        },
        {
          cmd: 'npm run check:schema',
          desc: '比对数据库实际表结构与迁移预期',
          when: '执行新迁移后',
        },
        {
          cmd: 'npm run check:cities',
          desc: '城市数据三处一致性检查（迁移 / 常量 / 接口）',
          when: '改动城市相关数据后',
        },
        {
          cmd: 'npm run typecheck',
          desc: 'tsc --noEmit 全仓类型检查，要求 0 报错',
          when: '每次改动后',
        },
        {
          cmd: 'npm run test:run',
          desc: 'vitest 单元测试，当前 82 条全过',
          when: '每次改动后',
        },
        {
          cmd: 'npm run test:e2e',
          desc: 'Playwright 端到端 8 条（需 dev server 在跑 + 测试凭据）',
          when: '发布前 / 改动核心链路后',
        },
        {
          cmd: 'npm run audit:mobile',
          desc: '真机尺寸移动端审计，检查横向溢出',
          when: '改动页面布局后',
        },
      ],
    },
  },
  /** M335 A03 用户列表：约束说明、筛选、表头、留痕、状态块、会员/删除弹窗（按原型原文） */
  ADMIN_USERS: {
    noticeLead: '本页突破原 PRD“管理员后台只读，不做编辑 / 删除 / 踢出用户”的约束：',
    noticeStrong: '开通 / 取消会员身份是管理员唯一允许的写操作',
    noticeTail: '，其余能力仍为只读。该变更需产品确认后进入编码。',
    searchPlaceholder: '搜索邮箱或用户名',
    statusAll: '全部',
    statusOn: '在线',
    statusOff: '离线',
    identityAll: '全部身份',
    identityFree: '普通用户',
    identityMember: '会员用户',
    logTitle: '会员操作留痕（模拟事件记录）',
    logTag: '唯一写操作',
    logLimit: '操作人：运营管理员',
    logEmpty: '暂无会员操作记录，开通 / 取消会员后在此留痕。',
    thEmail: '邮箱',
    thUsername: '用户名',
    thRole: '角色',
    thOnline: '在线状态',
    thLastSeen: '最后活跃',
    thIdentity: '用户身份',
    thMemberAction: '管理员操作（会员）',
    thDelete: '删除账号',
    thCreatedAt: '注册时间',
    online: '在线',
    offline: '离线',
    memberFixed: '最高级会员',
    memberBadge: '会员用户',
    memberNone: '普通用户',
    /** T-018 会员三态徽章（仅新增，不改既有键语义） */
    memberAdminBadge: '管理员 · 永久',
    memberForever: '永久会员',
    memberActiveUntil: (d: string) => `会员 · 到期 ${d}`,
    memberExpired: '已过期',
    memberActionFixed: '默认最高级会员',
    memberGrant: '开通会员',
    memberRevoke: '取消会员',
    deleteAccount: '删除账号',
    noMatchPrefix: '没有匹配“',
    noMatchSuffix: '”的用户',
    clearSearch: '清空搜索',
    emptyTitle: '暂无注册用户',
    emptyDesc: '用户完成邮箱注册后会出现在这里',
    errorTitle: '用户列表加载失败',
    footNote:
      '只读页面：除“开通 / 取消会员”外，不提供编辑、删除、禁用或踢出操作。角色列（普通用户 / 管理员）为账号权限，用户身份列（普通用户 / 会员用户）为会员权益状态，两者含义不同。',
    modalGrantTitle: '开通会员',
    modalRevokeTitle: '取消会员',
    modalTarget: (email: string, username: string | null) =>
      `目标用户：${email}${username ? `（${username}）` : ''}`,
    modalGrantDesc: (benefits: string) =>
      `开通后该用户身份变为「会员用户」，可享受会员权益（${benefits}）。`,
    modalRevokeDesc: '取消后该用户身份回到「普通用户」，将不再享受会员权益，历史路线与收藏保留。',
    modalNote: '第一版不真实收费，仅为原型模拟；该操作是管理员后台唯一允许的写操作。',
    modalCancel: '取消',
    modalConfirmGrant: '确认开通',
    modalConfirmRevoke: '确认取消',
    processing: '处理中…',
    deleteTitle: '删除账号',
    deleteConfirm: '确认删除',
    deleting: '删除中…',
    pagination: (n: number, page: number, total: number) => `共 ${n} 条 · 第 ${page} / ${total} 页`,
    prev: '上一页',
    next: '下一页',
  },
  /** M336 A04 在线用户：统计卡、表头、脚注、空/失败状态（按原型原文） */
  ADMIN_ONLINE: {
    cardLabel: '当前在线',
    peopleSuffix: '人在线',
    info: (minutes: number) => `在线定义：最近 ${minutes} 分钟内有活跃心跳`,
    refreshedAt: '最后刷新：',
    thEmail: '邮箱',
    thUsername: '用户名',
    thLastSeen: '最后活跃',
    thCurrentPage: '当前页面',
    thSource: '用户来源',
    thDuration: '在线时长',
    guest: '未注册用户',
    noteUsername:
      '「用户名」按注册状态显示：已注册用户显示其用户名，未注册游客统一显示「未注册用户」（灰色徽标）。',
    noteSource: '「用户来源」表示该在线用户当前使用的客户端：小程序用户 / Web 网页用户。',
    refreshedBanner: '在线列表已刷新',
    emptyTitle: '当前无人在线',
    emptyDesc: (minutes: number) => `最近 ${minutes} 分钟内没有用户心跳，稍后可点击刷新`,
    refresh: '刷新',
    errorTitle: '在线数据获取失败',
    footNote: '只读页面：不提供踢出、封禁或发送消息操作。',
  },
  /** M337 A05 地点列表：筛选、表头、状态块、脚注（按原型原文） */
  ADMIN_PLACES: {
    searchPlaceholder: '搜索地点名或创建者邮箱',
    cityAll: '全部城市',
    typeAll: '全部类型',
    thName: '地点名称',
    thType: '类型',
    thCity: '城市 / 区域',
    thSource: '来源',
    thGeo: '坐标匹配',
    thOwner: '创建者',
    thCreatedAt: '创建时间',
    noMatch: '没有符合筛选条件的地点',
    resetFilter: '重置筛选',
    emptyTitle: '暂无地点数据',
    emptyDesc: '用户导入并确认地点后会出现在这里',
    errorTitle: '地点列表加载失败',
    footNote: '只读页面：不提供编辑、合并或删除地点操作。',
    pagination: (n: number, page: number, total: number) => `共 ${n} 条 · 第 ${page} / ${total} 页`,
    prev: '上一页',
    next: '下一页',
  },
  /** M338 A06 路线列表：筛选、表头、抽屉、状态块、脚注（按原型原文） */
  ADMIN_ROUTES: {
    searchPlaceholder: '搜索路线名或创建者邮箱',
    transportAll: '全部交通',
    daysAll: '单日 + 多日',
    daysSingle: '单日',
    daysMulti: '多日',
    thTitle: '路线名称',
    thCity: '城市',
    thOrigin: '出发城市',
    thDays: '天数',
    thPlaces: '地点数',
    thIntercity: '城际交通',
    thCityTransport: '市内交通',
    thLodging: '住宿',
    thManual: '手动调整',
    thOwner: '创建者',
    thUpdatedAt: '更新时间',
    thDetail: '详情',
    detailView: '详情',
    manualNone: '—',
    noMatch: '没有符合筛选条件的路线',
    resetFilter: '重置筛选',
    emptyTitle: '暂无路线数据',
    emptyDesc: '用户保存路线后会出现在这里',
    errorTitle: '路线列表加载失败',
    footNote: '只读页面：可查看路线详情，不提供编辑、删除或公开操作。',
    drawerTitle: '路线详情',
    drawerReadonly: '只读',
    closeAria: '关闭',
    pagination: (n: number, page: number, total: number) => `共 ${n} 条 · 第 ${page} / ${total} 页`,
    prev: '上一页',
    next: '下一页',
  },
  /** M339 A07 导入记录：筛选、表头、状态块、脚注（按原型原文） */
  ADMIN_IMPORTS: {
    searchPlaceholder: '搜索用户邮箱或内容关键词',
    statusAll: '全部',
    thTime: '导入时间',
    thUser: '用户',
    thCity: '城市',
    thSource: '来源',
    thInput: '输入方式',
    thSummary: '内容摘要',
    thExtract: '提取 / 确认',
    thStatus: '状态',
    noMatch: '没有符合条件的导入记录',
    resetFilter: '重置筛选',
    emptyTitle: '暂无导入记录',
    emptyDesc: '用户粘贴链接或分享文案后会产生导入记录',
    errorTitle: '导入记录加载失败',
    footNote:
      '只读页面：不提供重新提取、编辑或删除操作。导入内容只保存用户主动粘贴的文本，不爬取平台内容。',
    pagination: (n: number, page: number, total: number) => `共 ${n} 条 · 第 ${page} / ${total} 页`,
    prev: '上一页',
    next: '下一页',
  },
  /** M340 U10 会员收银台（阶段 3）：套餐选择、收款码、付款备注、提交、待核销提示（收款码人工核销） */
  MEMBER_ORDER: {
    cashierTitle: '开通会员（收款码核销）',
    cashierDesc: '选择套餐，扫码付款后填写付款备注并提交，管理员核对到账后自动为你开通会员。',
    planLabel: '选择套餐',
    planPrice: (yuan: string) => `¥${yuan}`,
    planValidity: (days: number) => `${days} 天`,
    planMeta: (price: string, validity: string) => `${price} · ${validity}`,
    payChannelLabel: '选择付款方式',
    qrAlt: (channel: string) => `${channel}收款码`,
    scanTip: '扫码付款后点击「我已完成付款」，管理员核对到账后自动开通',
    qrMissing: '收款码暂未配置，请联系管理员',
    payNoteLabel: '付款备注 / 交易单号',
    payNotePlaceholder: '填写转账备注或交易单号，便于管理员核对',
    submit: '我已完成付款',
    cancel: '取消',
    processing: '提交中…',
    /** A 半自动链路：提交后进入「等待到账确认」态（弹窗内轮询，核销后自动关闭） */
    waitingTitle: '等待到账确认',
    waitingDesc: '已收到你的付款申请。管理员核对到账后会立即为你开通会员，本弹窗会自动关闭，无需手动刷新。',
    waitingOrder: (orderId: string) => `订单号 ${orderId}`,
    waitingHint: '请保持本页面打开，通常几分钟内即可完成',
    /** 轮询到管理员已核销 → 自动关闭弹窗并提示成功 */
    successTitle: '开通成功',
    successDesc: (validity: string) => `会员已开通，有效期至 ${validity}。`,
    successTitleForever: '会员已开通，感谢支持！',
    /** 轮询到被驳回 → 提示原因并允许重新提交 */
    rejectedTitle: '订单未通过核对',
    rejectedDesc: (reason: string | null) =>
      reason
        ? `未通过原因：${reason}。如有疑问请联系管理员，或重新提交订单。`
        : '管理员未能核对到这笔到账。如已付款请联系管理员核实，或重新提交订单。',
    rejectedRetry: '重新提交',
    /** 等待超时（未核销）提示：不阻塞用户，关闭后开通依然生效 */
    pollTimeout: '暂时还没确认到账。你可以先关闭本窗口，管理员开通后会立即生效，稍后回来查看即可。',
    close: '知道了',
    pendingTip: '你有一笔待核销的订单，管理员核销后自动开通会员。',
    pendingTipPlan: (plan: string, time: string) => `待核销订单：${plan} · 提交于 ${time}`,
    errPendingFull: '你已有待核销的订单，请先等待管理员核销后再提交',
    errUseOrderFlow: '当前已启用付费开通，请通过会员收银台提交订单',
    errOrderFailed: '订单提交失败，请稍后重试',
    errInvalidPlan: '请选择有效的套餐',
    errInvalidChannel: '请选择有效的付款方式',
    errLoadFailed: '订单加载失败，请稍后重试',
    /** T-025 内测模式（BILLING_ENABLED=false）：付费入口关闭时的统一提示（前端购买区 + 服务端 403 兜底共用） */
    paused: '内测阶段暂未开放购买，感谢关注',
    /** T-051：管理后台「开放付费」开关关闭时的收银台提示（区别于 T-025 内测文案） */
    pausedByFlag: '暂停购买，请稍后再试',
    payNoteTooLong: (max: number) => `付款备注最多 ${max} 个字`,
  },
  /**
   * M342 新会员订单到账提醒（外发到企业微信群机器人）。
   * 管理员收到后即可上线核对流水并核销。
   */
  ORDER_NOTIFY: {
    title: '【待核销】新的会员开通付款',
    lineUser: (email: string) => `用户：${email}`,
    linePlan: (plan: string, amount: string) => `套餐：${plan}（${amount}）`,
    lineChannel: (channel: string) => `付款方式：${channel}`,
    lineNote: (note: string) => `付款备注：${note}`,
    lineNoteEmpty: '付款备注：无（请以金额与时间核对）',
    lineTime: (time: string) => `提交时间：${time}`,
    lineOrder: (orderId: string) => `订单号：${orderId}`,
    footer: '请核对收款流水后到「管理后台 → 会员订单」点「确认开通」。',
    errSendFailed: '订单提醒发送失败（群机器人通道）',
    errTokenFailed: '订单提醒发送失败（应用通道：取 access_token 失败）',
    errAppSendFailed: '订单提醒发送失败（应用通道）',
  },
  /** M341 A08 管理端会员订单（阶段 3）：待核销置顶、确认开通 / 驳回、状态块（按原型原文风格） */
  ADMIN_ORDERS: {
    notice: '本页为阶段 3 会员付费订单的人工核销入口：核对收款后为下单用户开通会员。',
    desc: '待核销订单置顶，核对到账后点「确认开通」；无法核对的点「驳回」并填写原因。',
    filterAll: '全部',
    filterPending: '待核销',
    filterReviewed: '已处理',
    thTime: '下单时间',
    thUser: '用户',
    thPlan: '套餐',
    thChannel: '付款方式',
    thAmount: '金额',
    thNote: '付款备注',
    thStatus: '状态',
    thAction: '操作',
    amount: (yuan: string) => `¥${yuan}`,
    noNote: '—',
    approve: '确认开通',
    reject: '驳回',
    processing: '处理中…',
    rejectTitle: '驳回订单',
    rejectDesc: (email: string) => `驳回 ${email} 的这笔订单，用户不会因此开通会员。`,
    rejectReasonLabel: '驳回原因',
    rejectReasonPlaceholder: '如：未收到对应款项 / 金额不符',
    rejectConfirm: '确认驳回',
    cancel: '取消',
    approveSuccess: '已开通会员',
    rejectSuccess: '订单已驳回',
    actionFailed: '操作失败，请稍后重试',
    errNotFound: '订单不存在',
    errNotPending: '该订单已处理，无法重复操作',
    emptyTitle: '暂无会员订单',
    emptyDesc: '用户在会员收银台提交订单后会出现在这里',
    errorTitle: '订单列表加载失败',
    errorDesc: '网络异常，请稍后重试',
    footNote: '核销后自动为该用户写入会员身份与有效期，并记录在会员操作留痕中。',
    pagination: (n: number, page: number, total: number) => `共 ${n} 条 · 第 ${page} / ${total} 页`,
    prev: '上一页',
    next: '下一页',
  },
  /** M342 路线长图导出 / 二维码分享 / 公开分享页（阶段 3） */
  SHARE: {
    /** 路线结果页按钮 */
    exportBtn: '导出长图',
    shareBtn: '分享二维码',
    locked: '会员可用',
    lockedTitle: '「导出长图 / 分享」为会员功能，升级会员后可用',
    upgradeTitle: '升级会员解锁「导出长图 / 分享」',
    upgradeDesc: '导出高清长图与二维码分享为会员专享，前往个人中心升级为会员后即可使用。',
    upgradeGo: '去升级会员',
    upgradeCancel: '暂不升级',
    /** 长图弹层 */
    modalTitle: '路线长图 / 二维码分享',
    modalDesc: '长图已生成，可点击下载；扫码或复制链接可在手机浏览器打开网页版。',
    generating: '正在生成长图…',
    download: '下载长图',
    downloadName: '路线长图.png',
    copyLink: '复制分享链接',
    copied: '链接已复制',
    copyFailed: '复制失败，请手动复制下方链接',
    failTitle: '长图生成失败',
    failDesc: '网络或浏览器异常，请稍后重试。',
    /** 服务端分享接口错误 */
    failSave: '分享链接生成失败，请稍后重试',
    failNotFound: '路线不存在或不属于当前账号',
    needMember: '「导出长图 / 分享」为会员功能，升级会员后可用',
    importNotFound: '分享链接不存在或已失效',
    close: '关闭',
    qrAlt: '分享二维码',
    qrHint: '扫码打开网页版查看完整路线',
    linkLabel: '分享链接',
    /** 长图内文案 */
    posterSubtitle: '路线长图',
    posterQrHint: '扫码打开网页版查看完整路线',
    posterFooter: (date: string) => `生成于 ${date}`,
    dayTitle: (day: number) => `第 ${day} 天`,
    placesTotal: (count: number) => `共 ${count} 个地点`,
    /** 公开分享页 */
    summary: (city: string, days: number, count: number) => `${city} · ${days} 天 · ${count} 个地点`,
    summarySingle: (city: string, count: number) => `${city} · 单日 · ${count} 个地点`,
    noCity: '未指定城市',
    tripInfo: (intercity: string, lodging: string) => `城际交通：${intercity} · 住宿：${lodging}`,
    viewOnlyTip: '你现在只能查看路线排序。升级会员后可导出长图，并把这套路线导入到自己账号。',
    goUpgrade: '去升级会员',
    importBtn: '导入到我的路线',
    importing: '导入中…',
    importHint: '导入后可在「我的路线」继续编辑，并导出长图分享。',
    importSuccess: '已导入到我的路线',
    importFailed: '导入失败，请稍后重试',
    loginToImport: '登录后导入',
    backHome: '返回首页',
    linkInvalidTitle: '链接已失效',
    linkInvalidDesc: '该分享链接不存在或已被作者关闭，请向对方重新索取。',
    /** T-017 C9：查询异常/超时与「链接失效」区分（仅新增，不改既有键） */
    loadFailedTitle: '加载失败，请稍后重试',
    loadFailedDesc: '网络或服务暂时不可用，链接本身可能仍然有效，稍后重试即可。',
    reload: '重试',
    sharedBy: '分享的路线',
    /** 访问者档位角标 */
    tierMember: '会员',
    tierAdmin: '管理员',
    /** T-007 F-52 非会员/游客分享海报视图 */
    posterGenerating: '正在生成路线图片…',
    posterFailed: '图片生成失败，以下为路线清单（仅名称与顺序）。',
    posterSave: '保存为图片',
    posterAlt: '路线海报图片',
    posterGuestTip: '完整路线与导入为会员功能，注册登录后升级会员即可使用。',
    posterGuestCta: '注册 / 登录',
    /** T-041 首页「导入分享路线」入口 + 导入弹层 */
    importHomeBtn: '导入分享路线',
    importMemberOnly: '会员可用该功能',
    dialogTitle: '导入分享路线',
    dialogDesc: '粘贴分享链接或上传含二维码的路线长图，先预览再选择导入方式',
    inputLabel: '分享链接 / token',
    inputPlaceholder: '例如 https://…/share/xxxxxxxx，或直接粘贴 token',
    modeRouteTitle: '建成我的路线',
    modeRouteDesc: '复制快照全部地点并在自己账号下新建一条路线（占用路线额度）',
    modePlacesTitle: '只收藏地点',
    modePlacesDesc: '只把地点写入收藏夹，不新建路线、不占路线额度',
    submit: '开始导入',
    submitting: '导入中…',
    invalidInput: '链接格式不正确，请粘贴完整的分享链接或 token',
    doneRoute: '已生成路线，可在「我的路线」的「会员分享路线」中查看',
    donePlaces: (n: number) => `已收藏 ${n} 个地点`,
    goMyRoutes: '去我的路线',
    goCollected: '去我的收藏夹',
    /** T-060 双入口（链接 / 二维码长图）→ 先预览 → 再选择动作 */
    tabLink: '粘贴链接',
    tabQr: '上传长图',
    qrTabDesc: '上传含二维码的路线长图（png / jpg / webp，≤7MB），自动识别分享链接',
    qrPick: '选择长图',
    qrBusy: '正在识别二维码…',
    qrTooLarge: '图片超过 7MB，请压缩后再上传',
    qrBadType: '仅支持 png / jpg / webp 图片',
    qrFailed: '没识别到二维码，请确认上传的是含分享二维码的路线长图',
    previewBtn: '查看路线预览',
    previewBusy: '正在加载预览…',
    previewTitle: '路线预览',
    previewPlacesShown: (shown: number, total: number) =>
      shown < total ? `显示前 ${shown} 个，共 ${total} 个地点` : `共 ${total} 个地点`,
    previewExported: (date: string) => `分享时间：${date}`,
    previewBack: '返回重新选择',
    revoked: '该分享已被作者关闭',
    previewFailed: '预览加载失败，请稍后重试',
  },
  /** M343 游客试用（免登录）：设置路线 / 挑选地点 / 查看结果三步（草稿存 sessionStorage，关闭页面即清空） */
  TRY: {
    /** 通用步骤名与角标 */
    guestBadge: '游客试用',
    stepNew: '设置路线',
    stepPick: '挑选地点',
    stepResult: '查看结果',
    /** 第 1 步：设置路线 */
    NEW: {
      title: '试用：设置这条路线',
      desc: '不用注册也能走一遍完整流程：选城市、定行程、挑地点、看路线。草稿只存在浏览器里，关闭页面即清空；只有最后「保存路线」需要登录。',
      /** 旅行城市（终点）由「选择城市」页决定，不在本页选择 */
      destRequired: '请先在「选择城市」页选择旅行城市',
      cityHint: '出发城市与终点城市相互独立：选出发城市不会改动上面的旅行城市与路线标题。',
      daysLabel: '行程天数',
      daysSingle: '单日',
      daysSingleSub: '1 天走完',
      daysMany: '多日',
      daysManySub: `${BUSINESS.MIN_DAYS} 天以上`,
      daysManyLocked: '登录后可用',
      daysGuestHint:
        '游客试用为单日行程（与正常版一致）；多日行程登录后可创建，注册用户还享 1 次多日试用额度。',
      daysUnitPre: '共',
      daysUnitPost: '天',
      transportLabel: '市内交通',
      transportHint: '整条路线在旅行城市内统一使用一种交通方式，用于估算距离和时间。',
      /** T-016：游客交通锁定步行的说明 */
      transportGuestLocked: '游客试用固定为步行，注册/登录后可选择骑行、公交地铁、驾车',
      lodgingTitle: '住宿（选填）',
      lodgingHint: '填了住宿名称或区域，路线会以住宿为起点；不填则以第一个地点为起点。',
      lodgingNameLabel: '住宿名称',
      lodgingNamePlaceholder: '例如：某民宿（可不填）',
      lodgingAreaLabel: '住宿区域',
      lodgingAreaPlaceholder: '例如：宽窄巷子附近',
      next: '下一步：挑选地点',
      backHome: '返回首页',
    },
    /** 第 2 步：挑选地点（界面与普通用户 U07 同构：筛选 + 勾选列表 + 路线设置侧栏） */
    PICK: {
      /** 页头标题后缀，与普通用户 U07 的「· 已导入地点」同一位置 */
      titleSuffix: '· 挑选地点',
      desc: '从数据库里已有的地点中挑选（跨用户共享，只展示名称 / 类型 / 地址等公共信息），也可以在上面粘贴文案导入自己的地点。选好后会按就近、不绕路的顺序排路线。',
      loading: '正在读取该城市的地点…',
      /** 空状态（游客可以自己导入，因此不只指向「换城市」） */
      emptyGuest: '这座城市暂时还没有已入库的地点，可以在上面粘贴文案导入自己的地点，或换个城市试试',
      error: '地点读取失败，请稍后重试',
      rateLimited: '今天的试用次数已用完，请明天再来或直接登录',
      retry: '重新加载',
      minPlaces: `至少选 ${BUSINESS.GUEST_TRY_MIN_PLACES} 个地点才能生成路线`,
      maxPlaces: (max: number) => `一次最多选 ${max} 个地点`,
      /** 游客专属上限文案（替代对游客误导的 ROUTE_PLACES.limitNote，普通页文案不动） */
      limitGuest: `游客试用最多选 ${BUSINESS.GUEST_TRY_MAX_PLACES} 个地点（单日行程）`,
      /** 返回上一步（与普通用户 U07 页头按钮同一位置） */
      back: '上一步：设置路线',
      /** 侧栏「起点」只读说明：游客按离住宿最近的原则自动挑起点 */
      startAuto: '不指定（按就近不绕路自动排序，住宿坐标可用时从离住宿最近的地点出发）',
      /** 导入地点（游客免登录）：粘贴小红书笔记文案或链接，AI 提取后写入浏览器草稿（不落库） */
      importTitle: '导入地点',
      importDesc: '把小红书笔记里的文案复制过来粘贴、抖音可粘贴文案或链接，AI 帮你找出里面的景点和美食，加入下面的可选地点。',
      importPlaceholder: '粘贴小红书笔记文案或链接…',
      importSubmit: 'AI 提取并加入',
      importLoading: '正在识别文案里的地点…',
      importTip: '小红书链接有登录限制读不到正文，请复制笔记正文再粘贴，识别最稳。',
      importEmpty: '没能从这段文案里识别到地点，换个文案再试',
      importNoCoord:
        '识别到地点，但都没能在当前城市定位到坐标，换个文案再试（导入的地点必须能定位才能排路线）',
      importAdded: (count: number) => `已加入 ${count} 个导入地点，可在下方勾选`,
      importPartial: (added: number, failed: number) =>
        `已加入 ${added} 个导入地点；另有 ${failed} 个在当前城市定位不到坐标，未加入`,
      importCityMismatch: (detected: string, current: string) =>
        `这段文案里识别到的城市是「${detected}」，与当前试用的「${current}」不一致。请换一段文案，或重新选择城市。`,
      importDup: '识别到的地点都已经在列表里了，直接勾选即可',
      /** 导入地点在列表里的角标（游客特有，便于识别与移除自己导入的点） */
      importGroup: '我导入的',
    },
    /** 第 3 步：路线结果 */
    RESULT: {
      title: '这是排好序的试用路线',
      desc: '按就近、不绕路的顺序排好，每个路段显示里程与时间。保存路线需要登录，登录后就能把它存进你的账号。',
      loading: '正在按顺路顺序排路线…',
      error: '路线生成失败，请稍后重试',
      rateLimited: '今天的试用次数已用完，请明天再来或直接登录',
      retry: '重新尝试',
      noDraftTitle: '还没有可用的试用草稿',
      noDraftDesc: '请先设置路线并挑选地点，再来看结果。',
      noDraftGo: '去设置路线',
      tooFewTitle: '地点太少',
      tooFewDesc: `至少需要 ${BUSINESS.GUEST_TRY_MIN_PLACES} 个地点才能生成路线。`,
      tooFewGo: '去挑选地点',
      startLodging: (name: string) => `起点：住宿 · ${name}`,
      startPlaces: (name: string) => `起点：地点 · ${name}`,
      startFallback: (name: string) => `未解析到住宿坐标，已改为以第一个地点「${name}」为起点`,
      lodgingResolvedHint: '已把住宿位置设为起点',
      lodgingBadge: '住',
      transportLabel: '出行方式',
      transportHint: '切换出行方式后，会按该方式重新排序并重算每段里程与时间。',
      placesTotal: (count: number) => `共 ${count} 个地点`,
      duration: (minutes: number) =>
        minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${minutes} 分钟`,
      legMeta: (mode: string, km: string, min: string) => `${mode} · ${km} 公里 · 约 ${min}`,
      totalMeta: (km: string, min: string) => `全程约 ${km} 公里 · 在路上约 ${min}`,
      estimatedTip: '部分路段没算出真实路线，已按直线距离估算',
      save: '保存路线',
      saveTip: '注册/登录后才能保存这条路线',
      /** 已登录：按钮与提示（把试用草稿落库成当前账号的真实路线） */
      saveLoggedIn: '保存这条路线',
      saveLoggedInTip: '点击即可把这条试用路线存进你的账号',
      saving: '正在保存…',
      saveFailed: '保存失败，请稍后重试',
      saveSuccess: '已保存，正在打开你的路线…',
      loginCta: '去登录 / 注册',
      back: '返回上一步：挑选地点',
      mapNote: '底图与标记由高德地图提供',
      singleDay: '单日行程',
      dayLabel: (day: number) => `第 ${day} 天`,
      /** 顺序可调整（与普通用户结果页同一套：拖动序号 / 上移 / 下移 / 移到第 N 位） */
      reorderTip: '拖动左侧序号，或用 ↑ ↓ 调整地点顺序；每次调整都会按新顺序重算每段里程与时间。',
      reorderBusy: '正在按新顺序重算路段…',
      reorderFailed: '顺序没同步成功，已恢复原来的顺序，请稍后再试',
      reorderRateLimited: '今天调整顺序的次数已用完，请明天再来或直接登录后调整',
      lodgingFirstTip: '住宿点固定在起点（序号 0），不参与移动',
      /** T-008 转化链路：未登录结果页会员权益卡（要点取 PRODUCT.MEMBER_BENEFITS，不在此编数字） */
      upsellTitle: '升级会员，解锁这些',
      upsellBtn: '查看会员权益',
      /** 一键复位（F-50）：本地还原系统推荐顺序，零请求、不消耗额度 */
      resetBtn: '一键复位',
      resetDone: '已恢复系统推荐顺序',
    },
  },
} as const;

/** M70-U04 流程步骤条文案（U04 选城市 → U09 查看结果，共 6 步） */
export const FLOW_STEP_LABELS = [
  '选城市',
  '设置路线',
  '导入地点',
  '勾选地点',
  '调整路线',
  '查看结果',
] as const;
