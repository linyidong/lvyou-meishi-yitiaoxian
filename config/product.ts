/**
 * 产品常量（P01-P06、S01-S06、D01-D06）
 * 修改流程见 docs/同步清单参数-v1.0.md §9.3：先改 docs 清单，再改本文件。
 */
export const PRODUCT = {
  /** P01 产品名称 */
  NAME: '旅行美食一条线',
  /** P02 产品英文名 */
  NAME_EN: 'TravelFoodLine',
  /** P03 Slogan */
  SLOGAN: '景点美食，一条线走完',
  /** P04 简介 */
  DESCRIPTION: '把小红书/抖音收藏的景点和美食，按顺路顺序自动排成旅行路线',
  /** P05 联系邮箱 */
  CONTACT_EMAIL: '',
  /** P06 备案号 */
  ICP_NUMBER: '',

  /** S01 主色调 */
  COLOR_PRIMARY: '#F97316',
  /** S02 辅色调 */
  COLOR_SECONDARY: '#FACC15',
  /** S03 背景色 */
  COLOR_BACKGROUND: '#FFFFFF',
  /** S04 文字主色 */
  COLOR_TEXT: '#111827',

  /** S05 Logo 文件（public 目录） */
  LOGO_PATH: '/logo.svg',
  /** S06 Favicon 文件（public 目录） */
  FAVICON_PATH: '/favicon.ico',

  /** C08 Vercel 项目名（子域名前缀） */
  PROJECT_NAME: 'travel-food-line',
  /** D01 部署平台 */
  DEPLOY_PLATFORM: 'Vercel',
  /** D02 代码仓库 */
  DEPLOY_REPO: 'GitHub',
  /** D03 域名（暂用 Vercel 免费子域名，留空） */
  DEPLOY_DOMAIN: '',
  /** D04 Node 版本 */
  NODE_VERSION: '20.x',
  /** D05 Next.js 版本 */
  NEXT_VERSION: '14.x',
  /** D06 是否启用 Analytics */
  ENABLE_ANALYTICS: false,
} as const;
