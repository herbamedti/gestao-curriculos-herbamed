import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { z } from 'zod';
export const session = cache(async () => {
  const client = await db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/entrar');
  const access = await client.rpc('candidate_registration_status');
  if(!access.error&&access.data==='password_required')redirect('/primeiro-acesso');
  if(!access.error&&access.data==='required')redirect('/completar-cadastro');
  if (access.error || access.data!=='complete') redirect('/conta-indisponivel');
  return { client, user };
});
const accountContext = cache(async () => {
  const current = await session();
  const result = await current.client.rpc('account_area');
  const area = z.enum(['candidate', 'staff', 'staff_mfa']).safeParse(result.data);
  if (result.error || !area.success) redirect('/conta-indisponivel');
  return { ...current, area: area.data };
});
export const areaDestination = cache(async () => {
  const current = await accountContext();
  if (current.area === 'candidate') return '/candidato';
  if (current.area === 'staff_mfa') return '/seguranca';
  const result = await current.client.rpc('staff_navigation_permissions');
  if (result.error || !Array.isArray(result.data)) redirect('/conta-indisponivel');
  const permissions = result.data;
  const destinations = [
    ['dashboard.read','/rh'], ['jobs.read','/rh/vagas'], ['applications.read','/rh/candidaturas'],
    ['interviews.read','/rh/entrevistas'], ['candidates.read','/rh/candidatos'], ['talents.read','/rh/talentos'],
    ['messages.read','/rh/mensagens'], ['reports.read','/rh/relatorios'], ['users.manage','/rh/usuarios'],
    ['roles.manage','/rh/permissoes'], ['settings.read','/rh/configuracoes'], ['privacy.read','/rh/privacidade'],
    ['audit.read','/rh/auditoria'],
  ] as const;
  return destinations.find(([permission]) => permissions.includes(permission))?.[1] ?? '/rh/conta';
});
export const requireCandidate = cache(async () => {
  const current = await accountContext();
  if (current.area !== 'candidate') redirect(await areaDestination());
  return current;
});
export const requireStaff = cache(async () => {
  const current = await accountContext();
  if (current.area === 'candidate') redirect('/acesso-negado');
  if (current.area === 'staff_mfa') redirect('/seguranca');
  return current;
});
export async function requirePermission(permission: string, jobId?: string) {
  const current = await requireStaff();
  const { data } = await current.client.rpc('has_permission', { p_permission: permission, ...(jobId ? { p_job_id: jobId } : {}) });
  if (!data) redirect('/acesso-negado');
  return current;
}
