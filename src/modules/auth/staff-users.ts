'use server';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { session } from './session';
import { serviceDb } from '@/lib/service-db';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';
import { emailConfigured, sendEmail } from '@/modules/email/sender';
import { staffPassword, staffPermissions } from './staff-schema';
import type { ActionResult } from '@/lib/result';
const access = z.object({ name: z.string().trim().min(2).max(160), role_id: z.uuid() });
const flag = (form: FormData, key: string) => form.get(key) === 'on';

export async function manageStaffUsers(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { client, user } = await session();
  const allowed = await client.rpc('is_primary_administrator');
  if (allowed.error || !allowed.data) return { ok: false, message: 'Somente o administrador principal, com duas etapas confirmadas, pode gerenciar usuários.' };
  try {
    const op = z.enum(['create', 'access', 'password', 'resend']).parse(form.get('op'));
    if (op === 'access') {
      const parsed = access.parse(Object.fromEntries(form));
      const target = z.uuid().parse(form.get('user_id'));
      // Legacy callers that do not send exceptions keep the existing overrides.
      const details = form.has('permissions') ? null : await client.rpc('staff_administration_details');
      if (details?.error) return { ok: false, message: 'Não foi possível conferir as permissões atuais.' };
      const rows = details ? z.array(z.object({ user_id: z.uuid(), permissions: staffPermissions })).parse(details.data) : [];
      const permissions = form.has('permissions') ? staffPermissions.parse(JSON.parse(z.string().max(20000).parse(form.get('permissions')))) : rows.find(row => row.user_id === target)?.permissions || {};
      const changed = await client.rpc('update_staff_administration', { p_user_id: target, p_name: parsed.name, p_role_id: parsed.role_id,
        p_active: flag(form, 'active'), p_mfa: flag(form, 'mfa'), p_permissions: permissions });
      if (changed.error) return { ok: false, message: 'Não foi possível atualizar o acesso. Confira o perfil e as permissões. O administrador principal é protegido.' };
    } else {
      const service = serviceDb();
      if (!service) return { ok: false, message: 'A administração de contas está indisponível neste ambiente.' };
      if (op === 'password') {
        const value = staffPassword.parse(form.get('password'));
        if (value !== form.get('confirm_password')) return { ok: false, message: 'As senhas não coincidem.' };
        const target = z.uuid().parse(form.get('user_id'));
        const authorized = await client.rpc('authorize_staff_password_reset', { p_user_id: target });
        if (authorized.error || !authorized.data) return { ok: false, message: 'Esta conta não pode ter a senha alterada aqui.' };
        // Invitations must be completed by their recipient, never by an admin reset.
        const details = await client.rpc('staff_administration_details');
        const rows = z.array(z.object({ user_id: z.uuid(), pending: z.boolean() })).parse(details.data);
        if (details.error || rows.find(row => row.user_id === target)?.pending) return { ok: false, message: 'Reenvie o convite para que o usuário crie a própria senha.' };
        const changed = await service.auth.admin.updateUserById(target, { password: value });
        if (changed.error) return { ok: false, message: 'Não foi possível alterar a senha.' };
        const finished = await service.rpc('finish_staff_password_reset', { p_actor_id: user.id, p_user_id: target });
        if (finished.error) return { ok: false, message: 'A senha foi alterada, mas não foi possível bloquear as sessões anteriores. Desative o acesso desse usuário e tente novamente.' };
      } else {
        if (!emailConfigured()) return { ok: false, message: 'Configure e ative o envio de e-mail antes de convidar a equipe.' };
        let target: string; let address: string; let name: string; let hash: string; let type: 'invite' | 'recovery';
        if (op === 'create') {
          const parsed = access.extend({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) }).parse(Object.fromEntries(form));
          const permissions = staffPermissions.parse(JSON.parse(z.string().max(20000).parse(form.get('permissions') || '{}')));
          const role = await client.from('roles').select('id').eq('id', parsed.role_id).eq('active', true).maybeSingle();
          if (role.error || !role.data) return { ok: false, message: 'Selecione um perfil ativo.' };
          const reserved = await client.rpc('reserve_staff_invitation');
          if (reserved.error || !reserved.data) return { ok: false, message: 'Limite de convites atingido. Aguarde antes de tentar novamente.' };
          const request = randomUUID();
          const ticket = randomBytes(32).toString('hex');
          const reservation = await service.rpc('prepare_staff_invitation', { p_actor_id: user.id, p_email: parsed.email, p_ticket_hash: createHash('sha256').update(ticket).digest('hex') });
          if (reservation.error) return { ok: false, message: 'Não foi possível criar este convite. O e-mail pode já estar cadastrado.' };
          const created = await service.auth.admin.generateLink({ type: 'invite', email: parsed.email, options: { data: { staff_invitation_request: request, staff_invitation_ticket: ticket } } });
          if (created.error || !created.data.user || !created.data.properties || created.data.user.user_metadata.staff_invitation_request !== request)
            return { ok: false, message: 'Não foi possível criar este convite. O e-mail pode já estar cadastrado.' };
          target = created.data.user.id; address = parsed.email; name = parsed.name; hash = created.data.properties.hashed_token; type = 'invite';
          const granted = await service.rpc('provision_invited_staff', { p_actor_id: user.id, p_user_id: target, p_name: name, p_role_id: parsed.role_id,
            p_active: flag(form, 'active'), p_mfa: flag(form, 'mfa'), p_permissions: permissions });
          if (granted.error) {
            const removed = await service.auth.admin.deleteUser(target);
            log('auth.staff_provision_failed', { code: removed.error ? 'cleanup_failed' : 'access_rejected' });
            return { ok: false, message: 'Não foi possível conceder o perfil. A conta não recebeu acesso à gestão.' };
          }
          await service.auth.admin.updateUserById(target, { user_metadata: { staff_invitation_ticket: null, staff_invitation_request: null } });
        } else {
          target = z.uuid().parse(form.get('user_id'));
          const reserved = await client.rpc('reserve_staff_invitation', { p_user_id: target });
          if (reserved.error || !reserved.data) return { ok: false, message: 'Este convite não está disponível para reenvio. Confira o acesso ativo e aguarde ao menos um minuto entre envios.' };
          const account = await service.auth.admin.getUserById(target);
          if (account.error || !account.data.user.email) return { ok: false, message: 'Não foi possível localizar a conta.' };
          address = account.data.user.email; name = 'Equipe Herbamed';
          // A confirmed recipient who did not finish the first access uses recovery.
          type = account.data.user.email_confirmed_at ? 'recovery' : 'invite';
          const generated = await service.auth.admin.generateLink({ type, email: address });
          if (generated.error || generated.data.user?.id !== target || !generated.data.properties) {
            await service.rpc('record_staff_invitation', { p_actor_id: user.id, p_user_id: target, p_sent: false });
            revalidatePath('/rh/usuarios');
            return { ok: false, message: 'Não foi possível gerar o convite. Tente novamente mais tarde.' };
          }
          hash = generated.data.properties.hashed_token;
        }
        const link = new URL('/auth/confirm', config.url); link.searchParams.set('token_hash', hash); link.searchParams.set('type', type);
        let sent = false;
        try {
          await sendEmail({ to: address, subject: 'Seu convite para a equipe Herbamed', text: `Olá, ${name}.\n\nVocê recebeu um convite para acessar a gestão de talentos da Herbamed. Confirme seu e-mail e crie uma senha pessoal pelo link abaixo:\n\n${link}\n\nDepois de concluir, entre em: ${new URL('/entrar?perfil=rh', config.url)}\n\nSe o link expirar, solicite um novo convite ao administrador. Se você não reconhece este convite, ignore esta mensagem.\n\nEquipe Herbamed` });
          sent = true;
        } catch { log('auth.staff_invitation_delivery_failed', { code: 'mail_unavailable' }); }
        const recorded = await service.rpc('record_staff_invitation', { p_actor_id: user.id, p_user_id: target, p_sent: sent });
        revalidatePath('/rh', 'layout');
        if (recorded.error) return { ok: false, message: 'Não foi possível registrar a entrega do convite. Confira o cadastro antes de tentar novamente.' };
        return sent ? { ok: true, message: op === 'create' ? 'Usuário criado e convite enviado. O destinatário deve confirmar o e-mail e definir sua senha.' : 'Convite reenviado.' }
          : { ok: false, message: 'O cadastro foi preservado sem acesso à gestão. O e-mail não pôde ser enviado; confira o provedor e use Reenviar convite.' };
      }
    }
    revalidatePath('/rh', 'layout');
    return { ok: true, message: op === 'password' ? 'Senha alterada. As sessões anteriores perderam acesso; o usuário deve entrar novamente.' : 'Acesso atualizado.' };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message || 'Confira os dados informados.' };
    log('auth.staff_management_failed', { code: 'unexpected_error' });
    return { ok: false, message: 'Não foi possível concluir a operação.' };
  }
}
