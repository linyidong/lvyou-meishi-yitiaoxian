import { TRANSPORT } from '@/config/enums';

/** 交通方式（E03/E04） */
export type Transport = (typeof TRANSPORT)[keyof typeof TRANSPORT];

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
