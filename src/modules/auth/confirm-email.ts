'use server';
import { db } from '@/lib/supabase';
import { features } from '@/lib/config';
import type { ActionResult } from '@/lib/result';
import { confirmationSchema } from '@/modules/email/auth-messages';

export async function confirmEmail(_: ActionResult, form: FormData): Promise<ActionResult> {
  if (!features.email) return { ok: false, message: 'A confirmação por e-mail está temporariamente desativada.' };
  const input = confirmationSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { ok: false, message: 'O link é inválido. Solicite uma nova mensagem.' };
  try {
    const client = await db();
    const { data, error } = await client.auth.verifyOtp(input.data);
    if (error) return { ok: false, message: 'O link expirou ou já foi utilizado. Solicite uma nova mensagem.' };
    if (input.data.type === 'email_change') return {
      ok: true, message: 'Confirmação recebida. A alteração depende da confirmação no e-mail atual e no novo endereço.',
    };
    if (!data.session) return { ok: false, message: 'Não foi possível confirmar o acesso. Solicite uma nova mensagem.' };
    const setup = await client.rpc('candidate_registration_status');
    if (setup.error || setup.data === 'unavailable') return { ok: true, message: 'Acesso indisponível.', redirect: '/conta-indisponivel' };
    if (setup.data === 'password_required') return { ok: true, message: 'E-mail confirmado. Crie sua senha.', redirect: '/primeiro-acesso' };
    if (input.data.type === 'recovery' || input.data.type === 'invite')
      return { ok: true, message: 'Acesso confirmado.', redirect: '/nova-senha' };
    const { data: staff, error: staffError } = await client.rpc('is_staff');
    if (staffError) return { ok: false, message: 'Entre novamente para continuar.', redirect: '/entrar' };
    return { ok: true, message: 'Acesso confirmado.', redirect: staff ? '/seguranca' : '/candidato' };
  } catch { return { ok: false, message: 'Não foi possível confirmar agora. Tente novamente.' }; }
}
