/**
 * T-098 功能建议：页面 → 功能 的两级分类。
 * 后台意见箱按这两级聚合，方便看出「哪个页面的哪个功能」被提得最多。
 * key 一旦上线不要随便改（历史数据按 key 存），改文案只改 label。
 */
export interface FeedbackFeature {
  key: string;
  label: string;
}

export interface FeedbackPage {
  key: string;
  label: string;
  features: FeedbackFeature[];
}

export const FEEDBACK_PAGES: FeedbackPage[] = [
  {
    key: 'home',
    label: '首页',
    features: [
      { key: 'home-recommend', label: '热门城市推荐' },
      { key: 'home-recent', label: '我的最近路线' },
      { key: 'home-import', label: '导入分享路线' },
      { key: 'home-try', label: '游客试用入口' },
    ],
  },
  {
    key: 'new-route',
    label: '新建路线',
    features: [
      { key: 'new-city', label: '选择城市' },
      { key: 'new-settings', label: '设置路线' },
      { key: 'new-import', label: '导入地点' },
      { key: 'new-pick', label: '勾选地点' },
      { key: 'new-adjust', label: '调整路线' },
      { key: 'new-result', label: '查看结果' },
    ],
  },
  {
    key: 'routes',
    label: '我的路线',
    features: [
      { key: 'routes-mine', label: '我的路线' },
      { key: 'routes-member', label: '会员分享路线' },
      { key: 'routes-filter', label: '城市筛选 / 删除' },
    ],
  },
  {
    key: 'collected',
    label: '收藏夹',
    features: [
      { key: 'collected-list', label: '收藏地点列表' },
      { key: 'collected-manage', label: '筛选 / 取消收藏' },
    ],
  },
  {
    key: 'profile',
    label: '个人中心',
    features: [
      { key: 'profile-member', label: '会员卡 / 开通' },
      { key: 'profile-account', label: '账号资料' },
      { key: 'profile-password', label: '修改密码' },
    ],
  },
  {
    key: 'other',
    label: '其他 / 整体',
    features: [
      { key: 'other-style', label: '页面样式 / 布局' },
      { key: 'other-speed', label: '速度 / 稳定性' },
      { key: 'other-other', label: '其他建议' },
    ],
  },
];

export function findFeedbackPage(key: string): FeedbackPage | undefined {
  return FEEDBACK_PAGES.find((p) => p.key === key);
}

export function findFeedbackFeature(pageKey: string, featureKey: string): FeedbackFeature | undefined {
  return findFeedbackPage(pageKey)?.features.find((f) => f.key === featureKey);
}

/** 后台展示用：把 key 还原成「页面 · 功能」，未知 key 原样显示（历史数据兜底） */
export function feedbackLabel(pageKey: string, featureKey: string): { page: string; feature: string } {
  const page = findFeedbackPage(pageKey);
  const feature = page?.features.find((f) => f.key === featureKey);
  return {
    page: page?.label ?? pageKey,
    feature: feature?.label ?? featureKey,
  };
}
