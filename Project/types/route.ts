import { INTERCITY_MODE, LODGING_TYPE, TRANSPORT } from '@/config/enums';
import type { PlaceType } from './place';

/** 交通方式（E03/E04） */
export type Transport = (typeof TRANSPORT)[keyof typeof TRANSPORT];

/** 城际交通·去程（E15/E16） */
export type IntercityMode = (typeof INTERCITY_MODE)[keyof typeof INTERCITY_MODE];

/** 住宿类型（E17/E18） */
export type LodgingType = (typeof LODGING_TYPE)[keyof typeof LODGING_TYPE];

/** public.routes 行 */
export interface RouteRow {
  id: string;
  user_id: string;
  city_id: string | null;
  title: string;
  days: number;
  transport: Transport;
  /** 对应 BUSINESS.ENABLE_PUBLIC_ROUTES（第一版关闭） */
  is_public: boolean;
  /** 以下为 U05 / U08 / A06 出行设置字段，空 = 未填写 */
  origin_city: string | null;
  intercity_mode: IntercityMode | null;
  lodging_type: LodgingType | null;
  lodging_name: string | null;
  lodging_area: string | null;
  lodging_nights: number | null;
  created_at: string;
}

/** public.route_places 行；day_index / order_index 均为 0 基 */
export interface RoutePlaceRow {
  id: string;
  route_id: string;
  place_id: string;
  day_index: number;
  order_index: number;
  created_at: string;
}

/** 路线结果页使用：一天的点位顺序 */
export interface RouteDay {
  /** 0 基天数下标 */
  dayIndex: number;
  places: RoutePlaceWithPlace[];
}

/** route_places 关联到 places 的完整条目 */
export interface RoutePlaceWithPlace extends RoutePlaceRow {
  place: PlaceRef;
}

interface PlaceRef {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** 分享快照里的一个地点（自包含，不引用原 places 主键） */
export interface RouteSharePlace {
  name: string;
  type: PlaceType;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** 分享快照里的一天（dayIndex 为 0 基） */
export interface RouteShareDay {
  dayIndex: number;
  places: RouteSharePlace[];
}

/**
 * 路线分享快照（阶段 3）：写库时一次性组装好，分享页 / 长图 / 导入都只看它，
 * 不依赖原路线的归属与 RLS 权限。
 */
export interface RouteShareSnapshot {
  title: string;
  cityName: string | null;
  /** 天数（数字） */
  days: number;
  transport: Transport;
  totalPlaces: number;
  originCity: string | null;
  /** 城际交通·去程（结构化，导入时还原到新路线） */
  intercityMode: IntercityMode | null;
  /** 城际交通展示文案（服务端按 U09 口径预生成） */
  intercityLabel: string;
  /** 住宿类型 / 区域 / 名称 / 晚数（结构化，导入时还原到新路线） */
  lodgingType: LodgingType | null;
  lodgingArea: string | null;
  lodgingName: string | null;
  lodgingNights: number | null;
  /** 住宿展示文案（服务端按 U09 口径预生成） */
  lodgingLabel: string;
  /** 逐天地点清单 */
  dayPlans: RouteShareDay[];
  /** 快照生成时间（ISO） */
  exportedAt: string;
}
