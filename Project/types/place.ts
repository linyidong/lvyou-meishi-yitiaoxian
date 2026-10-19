import { GEO_STATUS, PLACE_TYPE } from '@/config/enums';
import type { ImportSource } from './import';

/** 地点类型（E01/E02，库内英文枚举，展示走 PLACE_TYPE_LABEL） */
export type PlaceType = (typeof PLACE_TYPE)[keyof typeof PLACE_TYPE];

/** 坐标匹配状态（E21/E22） */
export type GeoStatus = (typeof GEO_STATUS)[keyof typeof GEO_STATUS];

/** public.places 行 */
export interface PlaceRow {
  id: string;
  user_id: string;
  city_id: string | null;
  name: string;
  address: string | null;
  type: PlaceType;
  note: string | null;
  image_url: string | null;
  open_hours: string | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  /** 来源链接（小红书 / 抖音分享链接） */
  source_url: string | null;
  /**
   * 是否在「我的收藏」中（U11）。false = 已从收藏移除但行保留，
   * 用于支撑 route_places 的引用，避免删收藏时级联删掉路线上的站点。
   */
  is_collected: boolean;
  /** 来源（E05-E07），未登记为 null */
  source: ImportSource | null;
  /** 坐标匹配状态（E21/E22），A05 地点列表使用 */
  geo_status: GeoStatus;
  created_at: string;
}

/** 高德搜索返回的地点（未落库） */
export interface AmapPlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** 高德 POI 首张照片地址（extensions=all 才有），无图时为 null */
  imageUrl: string | null;
}
