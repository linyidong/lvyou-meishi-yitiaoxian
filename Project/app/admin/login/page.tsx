import { redirect } from 'next/navigation';
import { LoginClient } from '@/components/auth/LoginClient';
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
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <LoginClient mode="admin" initialError={searchParams.error} />
    </div>
  );
}
