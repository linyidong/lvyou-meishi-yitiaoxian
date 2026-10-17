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
  /** M74 顶部导航：我的收藏 */
  NAV_COLLECTED: '我的收藏',
  /** M75 顶部导航：个人中心 */
  NAV_PROFILE: '个人中心',
  /** M76 底部导航（移动端）：新建 */
  NAV_NEW_SHORT: '新建',
  /** M77 底部导航（移动端）：我的 */
  NAV_PROFILE_SHORT: '我的',
  /** M78 顶部导航未登录时的登录/注册按钮 */
  NAV_LOGIN_REGISTER: '登录 / 注册',
  /** M79 顶部导航未登录时的身份提示 */
  NAV_GUEST: '试用中',
  /** M80 头像菜单：退出登录 */
  MENU_LOGOUT: '退出登录',
  /** M81 头像菜单：退出中 */
  MENU_LOGGING_OUT: '退出中…',

  /** M100 U01 / U02 示例路线（成都首日：站点名、距离、图例） */
  SAMPLE_ROUTE: {
    cityLine: '成都 · 第 1 天 · 步行',
    tag: '示例',
    stations: ['宽窄巷子', '陈麻婆豆腐', '人民公园', '钟水饺', '春熙路'],
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
    desc: '从小红书、抖音粘贴分享文案，自由勾选想去的地点，系统按顺路顺序排好路线，你只需微调。',
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
    usernameLabel: '用户名',
    usernameOptional: '（选填）',
    usernamePlaceholder: '不填写则显示邮箱前缀',
    passwordLabel: '密码',
    passwordPlaceholder: `至少 ${BUSINESS.MIN_PASSWORD_LENGTH} 位，包含字母和数字`,
    remember: '7 天内自动登录',
    forgot: '忘记密码？',
    forgotTip: '第一版暂不提供找回密码，请联系客服邮箱 help@yitiaoxian.cn',
    submitLogin: '登录',
    submitRegister: '注册并登录',
    submitBusyLogin: '登录中…',
    submitBusyRegister: '注册中…',
    tryGuest: '先不登录，直接试用',
    /** 带着本地草稿进入登录页时的暂存提示 */
    fromDraftTip: '你的路线已暂存为本地草稿，登录后将自动合并到账号并继续保存。',
  },
  /** M103 U02 首页首屏文案 */
  HOME_HERO: {
    badge: '公开测试版 · 国内城市',
    titleLines: ['把收藏的景点和美食', '排成顺路的一条线'],
    desc: '粘贴小红书、抖音的分享文案，AI 帮你找出地点。想去哪些自己勾，系统按顺路顺序排好，不再来回绕路。',
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
    desc: '先把小红书 / 抖音的分享文案粘贴进来，AI 提取地点后存进你的收藏地点，暂时不用建路线。',
    count: (n: number) => `我的收藏地点：${n} 个`,
    hintEmpty: '还没有收藏，先粘贴一段分享文案试试',
    hintHas: '详情见“我的收藏地点”',
    btnImport: '粘贴文案导入',
    btnCollected: '我的收藏地点',
  },
  /** M106 U02「粘贴分享文案 · AI 提取收藏」流程文案 */
  HOME_IMPORT: {
    summary: '粘贴分享文案，AI 提取后直接收藏',
    tabText: '粘贴分享文案',
    tabLink: '粘贴链接',
    linkTip:
      '不会直接打开或读取小红书 / 抖音页面。若只有链接，请同时粘贴分享时自动生成的文案（标题与正文），AI 才能识别地点。',
    placeholderText: '例如：成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐……',
    placeholderLink:
      '粘贴链接，并在后面补充分享文案，例如：https://v.douyin.com/xxxx 成都必吃的 5 家店……',
    needText: '请先粘贴链接或分享文案',
    needTextTitle: '只识别到链接，请补充分享文案',
    needTextDesc:
      '在小红书 / 抖音点击“分享 → 复制链接”时，会一并复制一段文字。请把整段文字粘贴进来，或手动输入笔记里提到的地点。',
    sampleLabel: '试试示例：',
    samples: [
      {
        label: '小红书文案',
        value:
          '成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐，下午人民公园喝盖碗茶，晚上春熙路+太古里逛街，宵夜钟水饺和贺记蛋烘糕！第二天武侯祠、锦里古街，晚饭蜀九香火锅 📍王妈手撕烤兔 #成都美食 #成都旅行',
      },
      {
        label: '抖音文案+链接',
        value:
          '成都本地人私藏的 5 家苍蝇馆子！洞子口张老二凉粉、龙抄手、冒椒火辣、马旺子川菜，吃完去九眼桥吹风～ 复制打开抖音，看看【小满吃遍成都的作品】 https://v.douyin.com/iRkM8sQx/',
      },
      {
        label: '只有链接',
        value: 'https://www.xiaohongshu.com/discovery/item/66f1c0a2000000001e03b7d4',
      },
      {
        label: '无地点文案',
        value: '这次旅行太开心了！天气超好，吃得也很满足，强烈推荐大家秋天来玩～ #旅行日记',
      },
    ],
    extract: 'AI 提取地点',
    extractBusy: 'AI 正在识别…',
    manual: '不识别，手动输入地点',
    manualTitle: '手动输入地点',
    manualNamePlaceholder: '输入地点名称，如：鹤鸣茶社',
    manualAdd: '添加',
    manualEmptyName: '请输入至少 2 个字的地点名称',
    manualDuplicate: (name: string) => `「${name}」已在列表中`,
    resultTitle: (n: number) => `识别到 ${n} 个地点，勾选后收藏`,
    resultNote: 'AI 解析仅供参考，可修改名称与类型；重复地点会提示合并或跳过',
    repaste: '重新粘贴',
    save: (n: number) => `确认收藏 ${n} 个地点`,
    saveNote: '收藏后可在“我的收藏地点”随时加入路线',
    noResult: '没有识别到地点，可换一段文案或手动输入',
    saved: (n: number) => `已收藏 ${n} 个地点，可在“我的收藏地点”加入路线`,
  },
  /** M107 U02「四步排好一条线」 */
  HOME_STEPS: {
    title: '四步排好一条线',
    steps: [
      { no: '01', title: '选城市', desc: '先定这次要去的城市，地点只在该城市内规划。' },
      {
        no: '02',
        title: '粘贴文案导入',
        desc: '粘贴小红书/抖音分享文案，AI 提取地点，你来确认和修改。',
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
    newInfoDesc1: '原 PRD 只定义了“整条路线统一的步行 / 骑行”。本页新增的出发城市、城际交通（去程）与终点城市住宿均为',
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
    originManual: '没找到？手动输入出发城市名',
    originManualPlaceholder: '输入出发城市名',
    originManualUse: '使用',
    originNoResult: '没有匹配的国内城市，可点上面的“手动输入出发城市名”直接填写',
    originSame: '同城出发，无需城际交通。下面“城际交通·去程”可保持“暂不设置”。',
    intercityTitle: '城际交通 · 去程',
    intercityDesc1: '出发城市 → 旅行城市的',
    intercityDescStrong: '大交通',
    intercityDesc2: '方式，与下面“市内交通”（步行 / 骑行）是两回事。这里只做行程信息记录，不会查询班次或票价。',
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
    desc: '粘贴小红书/抖音分享文案，AI 帮你找出里面的景点和美食',
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
    favEmptyDesc: '粘贴小红书 / 抖音分享文案，AI 提取地点后会先存进“我的收藏”，再回来一键加入路线。',
    favEmptyImport: '在本页粘贴文案导入',
    favEmptyGo: '去我的收藏',
    noAddress: '待定位',
    /** 导入卡 */
    tabText: '粘贴分享文案',
    tabLink: '粘贴链接',
    linkTip:
      '第一版不会直接打开或读取小红书/抖音页面。若只有链接，请同时粘贴分享时自动生成的文案（标题与正文），AI 才能识别地点。',
    placeholderText: '例如：成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐……',
    placeholderLink:
      '粘贴链接，并在后面补充分享文案，例如：https://v.douyin.com/xxxx 成都必吃的 5 家店……',
    emptyInput: '请先粘贴链接或分享文案',
    needTextTitle: '只识别到链接，请补充分享文案',
    needTextDesc:
      '在小红书/抖音点击“分享 → 复制链接”时，会一并复制一段文字。请把整段文字粘贴进来，或手动输入笔记里提到的地点。',
    sampleLabel: '试试示例：',
    samples: [
      {
        label: '小红书文案',
        value:
          '成都两天一夜吃喝攻略🐼 第一站宽窄巷子拍照，中午去陈麻婆豆腐，下午人民公园喝盖碗茶，晚上春熙路+太古里逛街，宵夜钟水饺和贺记蛋烘糕！第二天武侯祠、锦里古街，晚饭蜀九香火锅 📍王妈手撕烤兔 #成都美食 #成都旅行',
      },
      {
        label: '抖音文案+链接',
        value:
          '成都本地人私藏的 5 家苍蝇馆子！洞子口张老二凉粉、龙抄手、冒椒火辣、马旺子川菜，吃完去九眼桥吹风～ 复制打开抖音，看看【小满吃遍成都的作品】 https://v.douyin.com/iRkM8sQx/',
      },
      {
        label: '只有链接',
        value: 'https://www.xiaohongshu.com/discovery/item/66f1c0a2000000001e03b7d4',
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
    loadingTitle: 'AI 正在识别文案中的地点…',
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
    asideImportedPre: '当前路线已导入',
    asideImportedPost: '个地点',
    asideGo: '去勾选',
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
    daysNote: '多日先按距离聚类，再均匀分配到每天；每天独立排顺序，不做时间优化',
    limitNote: `单日最多 ${BUSINESS.MAX_PLACES_PER_DAY} 个地点，单条路线最多 ${BUSINESS.MAX_PLACES_PER_ROUTE} 个地点`,
    transportLabel: '交通方式（整条路线统一）',
    generate: '生成路线',
    generateCount: (count: number) => `用 ${count} 个地点生成路线`,
    dayMinPlaces: (days: number) =>
      `每天至少安排 1 个地点：${days} 天需勾选至少 ${days} 个地点`,
    mapTitle: '已勾选地点分布（示意）',
    /** 生成中的遮罩 */
    genMaskDesc: '正在调用高德步行/骑行路径规划',
    /** 移除确认 */
    toastRemoved: (name: string) => `已移除“${name}”`,
    delTitle: '从这条路线移除地点？',
    delPre: '将移除“',
    delPost: '”。如需再加入，可在导入页重新添加。',
    delCancel: '取消',
    delConfirm: '移除',
    /** 生成失败 */
    errorTitle: '路线生成失败',
    errorDesc: '部分地点无法规划步行/骑行路径（如距离过远），请减少地点或切换交通方式后重试',
    errorBack: '返回调整',
    /** 空态 */
    emptyTitle: '还没有导入任何地点',
    emptyDesc: '粘贴小红书/抖音的分享文案，AI 帮你把地点找出来',
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
    allDays: '全部天',
    dayLabel: (day: number) => `第 ${day} 天`,
    dayMeta: (km: string, min: string) => `${km} 公里 · 约 ${min}`,
    typeSpot: '景点',
    typeFood: '美食',
    noAddress: '待定位',
    legMeta: (km: string, min: string) => `${km} 公里 · ${min}`,
    /** 示意地图 */
    mapNote: '示意地图 · 真实版本接入高德地图',
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
    /** 会员卡 */
    memberOnTitle: '你已成为会员用户',
    memberOnDesc: (benefits: string) => `已享受会员权益：${benefits}。`,
    memberOnMeta: (since: string, source: string) => `开通于 ${since} · ${source}`,
    sourceUnknown: '来源未知',
    upgradeTag: '会员权益',
    upgradeTitle: '升级为会员，解锁更强的路线规划',
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
    desc: '先从分享文案里收藏地点，再挑选加入路线。收藏库保存在你的账号下。',
    filterAll: '全部',
    searchPlaceholder: '搜索名称、城市、地址或备注',
    importBtn: '导入文案收藏',
    sum: (total: number, spot: number, food: number) =>
      `共 ${total} 个收藏 · 景点 ${spot} · 美食 ${food}`,
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
    emptyDesc: '粘贴小红书 / 抖音的分享文案，AI 提取地点后就能存进收藏库，暂时不用建路线。',
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
    readOnlyNote: '后台不提供编辑 / 删除 / 踢出',
    logout: '退出后台',
    browsingAs: '运营管理员',
    operatorInitial: '管',
    badgeReadonly: '只读',
    badgeUsers: '只读 · 会员操作除外',
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
    emptyTitle: '暂无数据',
    emptyDesc: '产品上线后，用户、地点、路线和导入数据会显示在这里',
    errorTitle: '概览数据加载失败',
    errorDesc: '统计接口超时，请稍后重试',
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
