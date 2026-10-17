import { LoaderCircle } from 'lucide-react';
import { MESSAGES } from '@/config/messages';

/** A01 管理员登录加载骨架（不套后台外壳） */
export default function AdminLoginLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-slate-700" />
        <p className="mt-3 text-sm text-slate-500">{MESSAGES.ADMIN_LOGIN_PAGE.verifying}</p>
      </div>
    </main>
  );
}
