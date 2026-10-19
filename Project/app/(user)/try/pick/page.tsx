import { TryPickClient } from '@/components/try/TryPickClient';

/**
 * R22 游客试用 · 第 2 步：挑选地点（免登录）。
 * 只从「库内已有地点」里勾选（来源 /api/try/city-places），选完合并进 sessionStorage 草稿。
 */
export default function TryPickPage() {
  return (
    <div className="pt-2 md:pt-6">
      <TryPickClient />
    </div>
  );
}
