'use server';
import { db } from '@/lib/supabase';
import { serviceDb } from '@/lib/service-db';
import { staffPassword } from './staff-schema';
import type { ActionResult } from '@/lib/result';
import { log } from '@/lib/logger';
import { redirect } from 'next/navigation';

export async function finishStaffOnboarding(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = staffPassword.safeParse(form.get('password'));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (parsed.data !== form.get('confirm_password')) return { ok: false, message: 'As senhas não coincidem.' };
  const client = await db();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) return { ok: false, message: 'Confirme o convite no seu e-mail antes de definir a senha.' };
  const status = await client.rpc('candidate_registration_status');
  if (status.error || status.data !== 'password_required') return { ok: false, message: 'Este primeiro acesso não está disponível. Solicite uma revisão ao administrador.' };
  const service = serviceDb();
  if (!service) return { ok: false, message: 'Não foi possível concluir o acesso neste ambiente.' };
  const changed = await client.auth.updateUser({ password: parsed.data });
  if (changed.error) return { ok: false, message: 'Não foi possível definir a senha. Abra novamente o convite ou solicite seu reenvio.' };
  const finished = await service.rpc('complete_staff_onboarding', { p_user_id: user.id });
  if (finished.error) {
    log('auth.staff_onboarding_failed', { code: 'completion_failed' });
    return { ok: false, message: 'A senha foi salva, mas o acesso ainda não foi liberado. Tente concluir novamente ou procure o administrador.' };
  }
  await client.auth.signOut({ scope: 'global' });
  redirect('/entrar?equipe=confirmada');
}
