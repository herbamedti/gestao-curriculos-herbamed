'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { session } from './session';
import type { ActionResult } from '@/lib/result';
import { serviceDb } from '@/lib/service-db';
import { features } from '@/lib/config';
import { emailConfigured, sendEmail } from '@/modules/email/sender';
import { MailDeliveryError } from '@/modules/email/graph';
import { log } from '@/lib/logger';

const codeSchema = z.string().trim().toUpperCase().regex(/^[A-F0-9]{10}$/);
const totpSchema = z.string().regex(/^\d{6}$/);
const nameSchema = z.string().trim().min(2).max(160);
const passwordSchema = z.string().min(12).max(128);
const emailSchema = z.email().max(254);

export async function sendAccountEmailCode(): Promise<ActionResult> {
  const { user } = await session();
  if (!features.email) return { ok: false, message: 'O envio de e-mail está temporariamente desativado. Use o aplicativo autenticador.' };
  const service = serviceDb();
  if (!user.email || !user.email_confirmed_at || !emailConfigured() || !service)
    return { ok: false, message: 'A confirmação por e-mail não está disponível para esta conta.' };
  const { data, error } = await service.rpc('issue_account_email_code', { p_user_id: user.id });
  const issued = z.object({ code: codeSchema, email: emailSchema }).safeParse(data);
  if (error || !issued.success)
    return { ok: false, message: 'Aguarde antes de solicitar outro código. O limite é de cinco envios por hora.' };
  const { code, email } = issued.data;
  try {
    await sendEmail({
      to: email,
      subject: 'Código de confirmação da conta Herbamed',
      text: `Seu código de confirmação é ${code}. Ele vence em 10 minutos. Se você não solicitou esta mudança, ignore esta mensagem.`,
    });
    return { ok: true, message: 'Enviamos um código para o e-mail atual da conta. Ele vale por 10 minutos.' };
  } catch (error) {
    log('email.account_failed', { code: error instanceof MailDeliveryError ? error.code : 'mail_provider_unavailable' });
    try {
      await service.rpc('revoke_account_email_code', { p_user_id: user.id, p_code: code });
    } catch {
      // The code will also expire automatically after ten minutes.
    }
    return { ok: false, message: 'Não foi possível enviar o código agora. Tente novamente.' };
  }
}

export async function updateAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { client, user } = await session();
  try {
    const op = z.enum(['name', 'email', 'password', 'mfa']).parse(form.get('op'));
    if (op === 'email' && !features.email)
      return { ok: false, message: 'A alteração do e-mail está temporariamente desativada.' };
    if (op === 'name') {
      const name = nameSchema.parse(form.get('name'));
      const { error } = await client.rpc('update_account_name', { p_name: name });
      if (error) return { ok: false, message: 'Não foi possível atualizar o nome.' };
      await client.auth.updateUser({ data: { full_name: name } });
      revalidatePath('/rh', 'layout');
      revalidatePath('/candidato', 'layout');
      return { ok: true, message: 'Nome atualizado.' };
    }
    if (op === 'mfa' && form.get('enabled') === 'true') {
      const { data, error } = await client.rpc('set_account_mfa', { p_enabled: true });
      if (error || !data) return { ok: false, message: 'Não foi possível ativar a autenticação em duas etapas.' };
      revalidatePath('/rh', 'layout');
      return { ok: true, message: 'Autenticação em duas etapas ativada.' };
    }
    const method = z.enum(['email', 'authenticator']).parse(form.get('method'));
    if (method === 'email' && !features.email)
      return { ok: false, message: 'A confirmação por e-mail está temporariamente desativada. Use o autenticador.' };
    const rawCode = form.get('code');
    const code = method === 'email' ? codeSchema.parse(rawCode) : totpSchema.parse(rawCode);
    if (op === 'mfa') {
      const enabled = z.enum(['true', 'false']).parse(form.get('enabled')) === 'true';
      const { data: staff } = await client.rpc('is_staff');
      if (!staff) return { ok: false, message: 'Somente a equipe interna pode alterar essa opção.' };
      if (method === 'authenticator') {
        const verified = await verifyAuthenticator(client, code);
        if (!verified) return { ok: false, message: 'Código do autenticador inválido.' };
      }
      const { data, error } = await client.rpc('set_account_mfa', {
        p_enabled: enabled,
        p_email_code: method === 'email' && !enabled ? code : undefined,
      });
      if (error || !data) return { ok: false, message: 'Não foi possível mudar a autenticação em duas etapas. Confirme o código e tente novamente.' };
      revalidatePath('/rh', 'layout');
      return { ok: true, message: enabled ? 'Autenticação em duas etapas ativada.' : 'Exigência de duas etapas desativada para sua conta.' };
    }
    // Microsoft owns its users' login email and password. Local password accounts
    // can use the application confirmation flow below.
    if (user.app_metadata.provider === 'azure')
      return { ok: false, message: 'O e-mail e a senha deste acesso são administrados pela Microsoft.' };
    const email = op === 'email' ? emailSchema.parse(form.get('email')).toLowerCase() : undefined;
    const password = op === 'password' ? passwordSchema.parse(form.get('password')) : undefined;
    if (email === user.email?.toLowerCase())
      return { ok: false, message: 'Informe um e-mail diferente do atual.' };
    if (password !== undefined && password !== passwordSchema.parse(form.get('confirm_password')))
      return { ok: false, message: 'As senhas não coincidem.' };
    if (method === 'authenticator') {
      if (!await verifyAuthenticator(client, code))
        return { ok: false, message: 'Código do autenticador inválido.' };
    } else {
      const { data, error } = await client.rpc('consume_account_email_code', { p_code: code });
      if (error || !data) return { ok: false, message: 'Código de e-mail inválido, expirado ou já utilizado.' };
    }
    if (op === 'email') {
      const { error } = await client.auth.updateUser({ email: email! });
      if (error) return { ok: false, message: 'Não foi possível solicitar a alteração do e-mail.' };
      return { ok: true, message: 'Solicitação enviada. Confirme os links recebidos no e-mail atual e no novo e-mail para concluir.' };
    }
    const service = serviceDb();
    if (!service)
      return { ok: false, message: 'A alteração de senha está indisponível neste ambiente.' };
    const { error } = await service.auth.admin.updateUserById(user.id, { password: password! });
    if (error) return { ok: false, message: 'Não foi possível alterar a senha.' };
    await client.auth.signOut({ scope: 'global' });
    return { ok: true, message: 'Senha alterada. Entre novamente.', redirect: '/entrar' };
  } catch {
    return { ok: false, message: 'Confira os campos e informe um código válido.' };
  }
}

type AuthClient = Awaited<ReturnType<typeof session>>['client'];
async function verifyAuthenticator(client: AuthClient, code: string) {
  const { data: factors, error } = await client.auth.mfa.listFactors();
  if (error || !factors?.totp.length) return false;
  const result = await client.auth.mfa.challengeAndVerify({ factorId: factors.totp[0].id, code });
  return !result.error;
}
