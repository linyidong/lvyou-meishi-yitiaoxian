import { redirect } from 'next/navigation';
import { AdminLoginClient } from '@/components/admin/AdminLoginClient';
import { USER_ROLE } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';

/** A01 管理员登录：登录后额外校验 users.role=admin */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role === USER_ROLE.ADMIN) redirect(ROUTES.ADMIN_HOME);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-slate-800">
      <AdminLoginClient initialError={searchParams.error} />
    </main>
  );
}
