'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { session } from './session';
import { safeError, type ActionResult } from '@/lib/result';
import { log } from '@/lib/logger';

export async function managePortalAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { client } = await session();
  const authorized = await client.rpc('is_primary_administrator');
  if (authorized.error || !authorized.data) return { ok: false, message: 'Somente o administrador principal com duas etapas confirmadas pode administrar as contas.' };
  try {
    const data = z.object({ user_id: z.uuid(), active: z.enum(['true', 'false']), reason: z.string().trim().min(3).max(1000) }).parse(Object.fromEntries(form));
    const { error } = await client.rpc('set_portal_account_access', { p_user_id: data.user_id, p_active: data.active === 'true', p_reason: data.reason });
    if (error) return safeError(error.code, error.message);
    revalidatePath('/rh/contas-candidatos');
    return { ok: true, message: data.active === 'true' ? 'Acesso reativado. O candidato precisa entrar novamente.' : 'Acesso desativado. As sessões existentes perderam acesso à plataforma.' };
  } catch {
    log('auth.portal_account_update_failed', { code: 'invalid_request' });
    return { ok: false, message: 'Informe um motivo entre 3 e 1.000 caracteres.' };
  }
}
