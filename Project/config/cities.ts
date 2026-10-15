/**
 * 城市常量（CT01-CT03）
 * 与数据库种子 supabase/migrations/011_seed_cities.sql 一一对应（SY07）：
 * 新增城市必须同时改本文件与 011_seed_cities.sql。
 */

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

/** CT01/CT03 内置城市数据（共 92 个） */
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
];
