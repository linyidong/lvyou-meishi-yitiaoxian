import { IMPORT_SOURCE, IMPORT_STATUS } from '@/config/enums';

/** 导入来源（E05-E07） */
export type ImportSource = (typeof IMPORT_SOURCE)[keyof typeof IMPORT_SOURCE];

/** 导入状态（E08/E09） */
export type ImportStatus = (typeof IMPORT_STATUS)[keyof typeof IMPORT_STATUS];

/** public.imports 行 */
export interface ImportRow {
  id: string;
  user_id: string;
  raw_text: string;
  source: ImportSource;
  status: ImportStatus;
  created_at: string;
}
