import { PLACE_TYPE } from '@/config/enums';

/** 地点类型（E01/E02，库内英文枚举，展示走 PLACE_TYPE_LABEL） */
export type PlaceType = (typeof PLACE_TYPE)[keyof typeof PLACE_TYPE];

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
  created_at: string;
}

/** 高德搜索返回的地点（未落库） */
export interface AmapPlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}
