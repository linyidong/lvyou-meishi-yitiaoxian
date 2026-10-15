-- 008_enable_rls.sql
-- 为全部表开启 RLS（策略见 009_rls_policies.sql）。

alter table public.users        enable row level security;
alter table public.cities       enable row level security;
alter table public.places       enable row level security;
alter table public.routes       enable row level security;
alter table public.route_places enable row level security;
alter table public.imports      enable row level security;
alter table public.events       enable row level security;

-- 授权：本项目已开启 Supabase「自动暴露新表」，此处显式补上，换环境时同样可用。
-- 只授 DML，实际能读写哪些行由 009 的 RLS 策略决定。
grant usage on schema public to anon, authenticated;

-- cities 是字典表，未登录用户也要能读（ALLOW_GUEST_TRIAL=true，见 B08）
grant select on public.cities to anon, authenticated;

grant select, insert, update, delete on public.users        to authenticated;
grant select, insert, update, delete on public.places       to authenticated;
grant select, insert, update, delete on public.routes       to authenticated;
grant select, insert, update, delete on public.route_places to authenticated;
grant select, insert, update, delete on public.imports      to authenticated;
grant select, insert, update, delete on public.events       to authenticated;
