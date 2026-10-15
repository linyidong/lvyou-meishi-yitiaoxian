/** public.cities 行（字典表，所有人可读） */
export interface CityRow {
  id: string;
  name: string;
  /** 高德城市编码 */
  adcode: string;
  created_at: string;
}
