/**
 * 城市常量（CT01-CT03）
 * 与数据库种子 supabase/migrations/011_seed_cities.sql 一一对应（SY07）：
 * 新增城市必须同时改本文件与 011_seed_cities.sql。
 * T-042 起另有小众城市种子 029_seed_niche_cities.sql，同样与本文件一一对应
 * （泉州、北海原本就在 011 中，029 用 ON CONFLICT DO NOTHING 兼容）。
 */
import type { LucideIcon } from 'lucide-react';
import {
  Beer,
  Building2,
  Castle,
  Coffee,
  CupSoda,
  Landmark,
  Mountain,
  MountainSnow,
  PawPrint,
  TreeDeciduous,
  TreePalm,
  Waves,
} from 'lucide-react';

/** CT02 首页展示的热门城市 */
export const HOT_CITIES = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '成都',
  '重庆',
  '杭州',
  '西安',
  '厦门',
  '南京',
] as const;

export interface City {
  name: string;
  /** 高德城市编码 adcode */
  adcode: string;
}

/**
 * CT04 U04 热门城市卡片（原型 U04 展示的 12 座，均为**模拟测试数据**）
 * 说明：icon 为图标组件（原型 mdi 图标的语义近似，本项目统一 lucide-react），
 * color/badge/keywords/districts/nearby 均为演示数据；
 * 城市名必须存在于 CT01 的 CITIES 中（落库查询用），其余字段仅用于界面展示与二级目的地展开。
 */
export interface CityCard {
  name: string;
  /** 卡片左上角图标（原型 mdi 图标的 lucide 近似） */
  icon: LucideIcon;
  /** 图标块配色（Tailwind 类，按原型逐字；原型主色块 rose-50/rose-600 按规范映射为 primary） */
  color: string;
  /** 右上角角标，可空（原型仅成都标注「示例数据最全」） */
  badge?: string;
  /** 城市关键词（三个词，原型为「火锅 · 熊猫 · 慢生活」） */
  keywords: readonly [string, string, string];
  /** 城市内地名（二级目的地，模拟数据，取自原型 spots） */
  districts: readonly string[];
  /** 同省 / 周边城市（二级目的地，模拟数据，取自原型 near） */
  nearby: readonly string[];
}

/** CT04 U04 热门城市卡片（12 座，顺序、配色与二级目的地与原型一致） */
export const CITY_CARDS: readonly CityCard[] = [
  {
    name: '成都',
    icon: PawPrint,
    color: 'bg-primary/5 text-primary',
    keywords: ['火锅', '熊猫', '慢生活'],
    districts: ['宽窄巷子', '锦里', '人民公园', '玉林路', '青城山', '都江堰'],
    nearby: ['乐山', '峨眉山', '眉山', '德阳', '资阳'],
  },
  {
    name: '重庆',
    icon: Mountain,
    color: 'bg-orange-50 text-orange-600',
    keywords: ['山城', '夜景', '小面'],
    districts: ['解放碑', '磁器口', '洪崖洞', '山城步道', '十八梯', '观音桥'],
    nearby: ['涪陵', '武隆', '江津', '永川', '大足'],
  },
  {
    name: '西安',
    icon: Castle,
    color: 'bg-amber-50 text-amber-700',
    keywords: ['古城', '碳水', '博物馆'],
    districts: ['回民街', '大唐不夜城', '永兴坊', '大雁塔', '城墙', '小南门'],
    nearby: ['咸阳', '渭南', '宝鸡', '秦岭', '华山'],
  },
  {
    name: '长沙',
    icon: CupSoda,
    color: 'bg-red-50 text-red-600',
    keywords: ['茶颜', '夜宵', '江景'],
    districts: ['橘子洲', '太平街', '文和友', '坡子街', '岳麓山', '解放西'],
    nearby: ['湘潭', '株洲', '浏阳', '岳阳', '宁乡'],
  },
  {
    name: '广州',
    icon: Coffee,
    color: 'bg-emerald-50 text-emerald-600',
    keywords: ['早茶', '骑楼', '糖水'],
    districts: ['上下九', '永庆坊', '西关', '珠江新城', '沙面', '东山口'],
    nearby: ['佛山', '顺德', '东莞', '中山', '肇庆'],
  },
  {
    name: '杭州',
    icon: Waves,
    color: 'bg-teal-50 text-teal-600',
    keywords: ['西湖', '龙井', '骑行'],
    districts: ['西湖', '灵隐寺', '龙井村', '西溪湿地', '九溪烟树', '小河直街'],
    nearby: ['宁波', '绍兴', '乌镇', '湖州', '舟山', '千岛湖', '莫干山'],
  },
  {
    name: '厦门',
    icon: TreePalm,
    color: 'bg-sky-50 text-sky-600',
    keywords: ['海岛', '沙茶面', '文艺'],
    districts: ['鼓浪屿', '曾厝垵', '沙坡尾', '八市', '环岛路', '集美学村'],
    nearby: ['漳州', '泉州', '平潭岛', '福州', '东山岛'],
  },
  {
    name: '北京',
    icon: Landmark,
    color: 'bg-red-50 text-red-700',
    keywords: ['胡同', '烤鸭', '古建'],
    districts: ['南锣鼓巷', '什刹海', '五道营', '北海公园', '798 艺术区', '杨梅竹斜街'],
    nearby: ['天津', '廊坊', '古北水镇', '延庆', '秦皇岛'],
  },
  {
    name: '上海',
    icon: Building2,
    color: 'bg-indigo-50 text-indigo-600',
    keywords: ['梧桐区', '本帮菜', '展览'],
    districts: ['武康路', '安福路', '愚园路', '衡山路', '西岸', '新天地'],
    nearby: ['苏州', '嘉兴', '乌镇', '南浔', '崇明岛'],
  },
  {
    name: '南京',
    icon: TreeDeciduous,
    color: 'bg-lime-50 text-lime-700',
    keywords: ['梧桐', '鸭血粉丝', '民国风'],
    districts: ['颐和路', '老门东', '夫子庙', '先锋书店', '玄武湖', '颐和路民国街区'],
    nearby: ['镇江', '扬州', '马鞍山', '滁州', '高淳'],
  },
  {
    name: '青岛',
    icon: Beer,
    color: 'bg-cyan-50 text-cyan-700',
    keywords: ['啤酒', '海鲜', '红瓦'],
    districts: ['台东', '八大关', '小麦岛', '老城区', '崂山', '啤酒街'],
    nearby: ['威海', '烟台', '日照', '潍坊', '养马岛'],
  },
  {
    name: '大理',
    icon: MountainSnow,
    color: 'bg-violet-50 text-violet-600',
    keywords: ['洱海', '古城', '骑行'],
    districts: ['大理古城', '喜洲古镇', '双廊', '才村码头', '苍山', '龙龛码头'],
    nearby: ['丽江', '洱源', '剑川', '宾川', '巍山'],
  },
];

/**
 * CT05 城市拼音表（空格分音节，便于同时派生全拼与首字母）
 * 仅用于 U04 搜索，如 "hz" → hang zhou → 杭州。
 */
export const CITY_PINYIN: Readonly<Record<string, string>> = {
  北京: 'bei jing',
  上海: 'shang hai',
  天津: 'tian jin',
  重庆: 'chong qing',
  广州: 'guang zhou',
  深圳: 'shen zhen',
  珠海: 'zhu hai',
  汕头: 'shan tou',
  佛山: 'fo shan',
  惠州: 'hui zhou',
  东莞: 'dong guan',
  中山: 'zhong shan',
  杭州: 'hang zhou',
  宁波: 'ning bo',
  温州: 'wen zhou',
  嘉兴: 'jia xing',
  绍兴: 'shao xing',
  金华: 'jin hua',
  舟山: 'zhou shan',
  台州: 'tai zhou',
  南京: 'nan jing',
  无锡: 'wu xi',
  徐州: 'xu zhou',
  常州: 'chang zhou',
  苏州: 'su zhou',
  南通: 'nan tong',
  扬州: 'yang zhou',
  成都: 'cheng du',
  绵阳: 'mian yang',
  乐山: 'le shan',
  宜宾: 'yi bin',
  西安: 'xi an',
  宝鸡: 'bao ji',
  咸阳: 'xian yang',
  厦门: 'xia men',
  福州: 'fu zhou',
  泉州: 'quan zhou',
  漳州: 'zhang zhou',
  武汉: 'wu han',
  宜昌: 'yi chang',
  襄阳: 'xiang yang',
  荆州: 'jing zhou',
  长沙: 'chang sha',
  岳阳: 'yue yang',
  张家界: 'zhang jia jie',
  郑州: 'zheng zhou',
  开封: 'kai feng',
  洛阳: 'luo yang',
  济南: 'ji nan',
  青岛: 'qing dao',
  烟台: 'yan tai',
  潍坊: 'wei fang',
  泰安: 'tai an',
  威海: 'wei hai',
  沈阳: 'shen yang',
  大连: 'da lian',
  哈尔滨: 'ha er bin',
  长春: 'chang chun',
  吉林: 'ji lin',
  石家庄: 'shi jia zhuang',
  秦皇岛: 'qin huang dao',
  保定: 'bao ding',
  承德: 'cheng de',
  太原: 'tai yuan',
  大同: 'da tong',
  合肥: 'he fei',
  芜湖: 'wu hu',
  黄山: 'huang shan',
  南昌: 'nan chang',
  景德镇: 'jing de zhen',
  九江: 'jiu jiang',
  赣州: 'gan zhou',
  南宁: 'nan ning',
  桂林: 'gui lin',
  北海: 'bei hai',
  海口: 'hai kou',
  三亚: 'san ya',
  贵阳: 'gui yang',
  遵义: 'zun yi',
  昆明: 'kun ming',
  丽江: 'li jiang',
  大理: 'da li',
  西双版纳: 'xi shuang ban na',
  拉萨: 'la sa',
  兰州: 'lan zhou',
  酒泉: 'jiu quan',
  西宁: 'xi ning',
  银川: 'yin chuan',
  呼和浩特: 'hu he hao te',
  鄂尔多斯: 'e er duo si',
  呼伦贝尔: 'hu lun bei er',
  乌鲁木齐: 'wu lu mu qi',
  // T-042 小众城市种子（泉州、北海原已在上方）
  东山: 'dong shan',
  霞浦: 'xia pu',
  婺源: 'wu yuan',
  桐庐: 'tong lu',
  平潭: 'ping tan',
  阳朔: 'yang shuo',
  兴义: 'xing yi',
  荔波: 'li bo',
  丹巴: 'dan ba',
  稻城: 'dao cheng',
  林芝: 'lin zhi',
  喀什: 'ka shi',
  伊宁: 'yi ning',
  潮州: 'chao zhou',
  顺德: 'shun de',
  肇庆: 'zhao qing',
  台山: 'tai shan',
};

/** 按城市名取全拼（无声调，去空格）与首字母；未配置拼音时返回空串 */
export function cityPinyin(name: string): { full: string; initials: string } {
  const syllables = CITY_PINYIN[name];
  if (!syllables) return { full: '', initials: '' };
  const parts = syllables.split(' ');
  return {
    full: parts.join(''),
    initials: parts.map((p) => p[0] ?? '').join(''),
  };
}

/** 按城市名取热门卡片数据；非热门城市返回 undefined */
export function cityCard(name: string): CityCard | undefined {
  return CITY_CARDS.find((c) => c.name === name);
}

/** CT01/CT03 内置城市数据（共 109 个：92 基础 + T-042 小众 17 新增，泉州/北海原已含） */
export const CITIES: readonly City[] = [
  // 直辖市
  { name: '北京', adcode: '110000' },
  { name: '上海', adcode: '310000' },
  { name: '天津', adcode: '120000' },
  { name: '重庆', adcode: '500000' },
  // 广东
  { name: '广州', adcode: '440100' },
  { name: '深圳', adcode: '440300' },
  { name: '珠海', adcode: '440400' },
  { name: '汕头', adcode: '440500' },
  { name: '佛山', adcode: '440600' },
  { name: '惠州', adcode: '441300' },
  { name: '东莞', adcode: '441900' },
  { name: '中山', adcode: '442000' },
  // 浙江
  { name: '杭州', adcode: '330100' },
  { name: '宁波', adcode: '330200' },
  { name: '温州', adcode: '330300' },
  { name: '嘉兴', adcode: '330400' },
  { name: '绍兴', adcode: '330600' },
  { name: '金华', adcode: '330700' },
  { name: '舟山', adcode: '330900' },
  { name: '台州', adcode: '331000' },
  // 江苏
  { name: '南京', adcode: '320100' },
  { name: '无锡', adcode: '320200' },
  { name: '徐州', adcode: '320300' },
  { name: '常州', adcode: '320400' },
  { name: '苏州', adcode: '320500' },
  { name: '南通', adcode: '320600' },
  { name: '扬州', adcode: '321000' },
  // 四川
  { name: '成都', adcode: '510100' },
  { name: '绵阳', adcode: '510700' },
  { name: '乐山', adcode: '511100' },
  { name: '宜宾', adcode: '511500' },
  // 陕西
  { name: '西安', adcode: '610100' },
  { name: '宝鸡', adcode: '610300' },
  { name: '咸阳', adcode: '610400' },
  // 福建
  { name: '厦门', adcode: '350200' },
  { name: '福州', adcode: '350100' },
  { name: '泉州', adcode: '350500' },
  { name: '漳州', adcode: '350600' },
  // 湖北
  { name: '武汉', adcode: '420100' },
  { name: '宜昌', adcode: '420500' },
  { name: '襄阳', adcode: '420600' },
  { name: '荆州', adcode: '421000' },
  // 湖南
  { name: '长沙', adcode: '430100' },
  { name: '岳阳', adcode: '430600' },
  { name: '张家界', adcode: '430800' },
  // 河南
  { name: '郑州', adcode: '410100' },
  { name: '开封', adcode: '410200' },
  { name: '洛阳', adcode: '410300' },
  // 山东
  { name: '济南', adcode: '370100' },
  { name: '青岛', adcode: '370200' },
  { name: '烟台', adcode: '370600' },
  { name: '潍坊', adcode: '370700' },
  { name: '泰安', adcode: '370900' },
  { name: '威海', adcode: '371000' },
  // 辽宁 / 黑龙江 / 吉林
  { name: '沈阳', adcode: '210100' },
  { name: '大连', adcode: '210200' },
  { name: '哈尔滨', adcode: '230100' },
  { name: '长春', adcode: '220100' },
  { name: '吉林', adcode: '220200' },
  // 河北
  { name: '石家庄', adcode: '130100' },
  { name: '秦皇岛', adcode: '130300' },
  { name: '保定', adcode: '130600' },
  { name: '承德', adcode: '130800' },
  // 山西
  { name: '太原', adcode: '140100' },
  { name: '大同', adcode: '140200' },
  // 安徽
  { name: '合肥', adcode: '340100' },
  { name: '芜湖', adcode: '340200' },
  { name: '黄山', adcode: '341000' },
  // 江西
  { name: '南昌', adcode: '360100' },
  { name: '景德镇', adcode: '360200' },
  { name: '九江', adcode: '360400' },
  { name: '赣州', adcode: '360700' },
  // 广西
  { name: '南宁', adcode: '450100' },
  { name: '桂林', adcode: '450300' },
  { name: '北海', adcode: '450500' },
  // 海南
  { name: '海口', adcode: '460100' },
  { name: '三亚', adcode: '460200' },
  // 贵州
  { name: '贵阳', adcode: '520100' },
  { name: '遵义', adcode: '520300' },
  // 云南
  { name: '昆明', adcode: '530100' },
  { name: '丽江', adcode: '530700' },
  { name: '大理', adcode: '532900' },
  { name: '西双版纳', adcode: '532800' },
  // 西藏 / 甘肃 / 青海 / 宁夏
  { name: '拉萨', adcode: '540100' },
  { name: '兰州', adcode: '620100' },
  { name: '酒泉', adcode: '620900' },
  { name: '西宁', adcode: '630100' },
  { name: '银川', adcode: '640100' },
  // 内蒙古 / 新疆
  { name: '呼和浩特', adcode: '150100' },
  { name: '鄂尔多斯', adcode: '150600' },
  { name: '呼伦贝尔', adcode: '150700' },
  { name: '乌鲁木齐', adcode: '650100' },
  // 小众城市种子（T-042，adcode 高德实测；泉州 350500 / 北海 450500 原已在上方）
  { name: '东山', adcode: '350626' },
  { name: '霞浦', adcode: '350921' },
  { name: '婺源', adcode: '361130' },
  { name: '桐庐', adcode: '330122' },
  { name: '平潭', adcode: '350128' },
  { name: '阳朔', adcode: '450321' },
  { name: '兴义', adcode: '522301' },
  { name: '荔波', adcode: '522722' },
  { name: '丹巴', adcode: '513323' },
  { name: '稻城', adcode: '513337' },
  { name: '林芝', adcode: '540400' },
  { name: '喀什', adcode: '653101' },
  { name: '伊宁', adcode: '654002' },
  { name: '潮州', adcode: '445100' },
  { name: '顺德', adcode: '440606' },
  { name: '肇庆', adcode: '441200' },
  { name: '台山', adcode: '440781' },
];
