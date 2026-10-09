import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
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
export const requireStaff = cache(async () => {
  const current = await session();
  const { data } = await current.client.rpc('is_staff');
  if (!data) redirect('/acesso-negado');
  return current;
});
export async function requirePermission(permission: string, jobId?: string) {
  const current = await requireStaff();
  const { data } = await current.client.rpc('has_permission', { p_permission: permission, ...(jobId ? { p_job_id: jobId } : {}) });
  if (!data) redirect('/acesso-negado');
  return current;
}
