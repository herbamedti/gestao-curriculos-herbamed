'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { session } from './session';
import { serviceDb } from '@/lib/service-db';
import { log } from '@/lib/logger';
import type { ActionResult } from '@/lib/result';

const password = z.string().min(12).max(128).refine(value => /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9\s]/.test(value), 'Use 12 a 128 caracteres, com maiúsculas, minúsculas, números e símbolos.');
const access = z.object({ name: z.string().trim().min(2).max(160), role_id: z.uuid() });
const flag = (form: FormData, key: string) => form.get(key) === 'on';

export async function manageStaffUsers(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { client, user } = await session();
  // Validate the request's JWT before obtaining any server admin client.
  const allowed = await client.rpc('is_primary_administrator');
  if (allowed.error || !allowed.data) return { ok: false, message: 'Somente o administrador principal, com duas etapas confirmadas, pode gerenciar usuários.' };
  try {
    const op = z.enum(['create', 'access', 'password']).parse(form.get('op'));
    if (op === 'access') {
      const parsed = access.parse(Object.fromEntries(form));
      const { error } = await client.rpc('update_managed_staff', { p_user_id: z.uuid().parse(form.get('user_id')), p_name: parsed.name,
        p_role_id: parsed.role_id, p_active: flag(form, 'active'), p_mfa: flag(form, 'mfa') });
      if (error) return { ok: false, message: 'Não foi possível atualizar o acesso. O administrador principal não pode ser alterado por esta tela.' };
    } else {
      const value = password.parse(form.get('password'));
      if (value !== form.get('confirm_password')) return { ok: false, message: 'As senhas não coincidem.' };
      const service = serviceDb();
      if (!service) return { ok: false, message: 'A administração de contas está indisponível neste ambiente.' };
      if (op === 'create') {
        const parsed = access.extend({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) }).parse(Object.fromEntries(form));
        const role = await client.from('roles').select('id').eq('id', parsed.role_id).eq('active', true).maybeSingle();
        if (role.error || !role.data) return { ok: false, message: 'Selecione um perfil ativo.' };
        const created = await service.auth.admin.createUser({ email: parsed.email, password: value, email_confirm: true });
        if (created.error || !created.data.user) return { ok: false, message: 'Não foi possível criar esta conta. O e-mail pode já estar cadastrado.' };
        const granted = await service.rpc('provision_staff', { p_actor_id: user.id, p_user_id: created.data.user.id,
          p_name: parsed.name, p_role_id: parsed.role_id, p_active: flag(form, 'active'), p_mfa: flag(form, 'mfa') });
        if (granted.error) {
          // Cleanup is limited to the account created by this invocation.
          const removed = await service.auth.admin.deleteUser(created.data.user.id);
          log('auth.staff_provision_failed', { code: removed.error ? 'cleanup_failed' : 'access_rejected' });
          return { ok: false, message: 'Não foi possível conceder o perfil. A conta não recebeu acesso à gestão.' };
        }
      } else {
        const target = z.uuid().parse(form.get('user_id'));
        const authorized = await client.rpc('authorize_staff_password_reset', { p_user_id: target });
        if (authorized.error || !authorized.data) return { ok: false, message: 'Esta conta não pode ter a senha alterada aqui.' };
        const changed = await service.auth.admin.updateUserById(target, { password: value });
        if (changed.error) return { ok: false, message: 'Não foi possível alterar a senha.' };
        const finished = await service.rpc('finish_staff_password_reset', { p_actor_id: user.id, p_user_id: target });
        if (finished.error) return { ok: false, message: 'A senha foi alterada, mas não foi possível bloquear as sessões anteriores. Desative o acesso desse usuário e tente novamente.' };
      }
    }
    revalidatePath('/rh', 'layout');
    return { ok: true, message: op === 'create' ? 'Usuário criado. Compartilhe a senha por um canal seguro. O primeiro acesso solicitará autenticador se duas etapas estiverem exigidas.'
      : op === 'password' ? 'Senha alterada. As sessões anteriores perderam acesso à gestão; o usuário deve entrar novamente.' : 'Acesso atualizado.' };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message === 'Use 12 a 128 caracteres, com maiúsculas, minúsculas, números e símbolos.' ? error.issues[0].message : 'Confira o nome, perfil, e-mail e senha informados.' };
    log('auth.staff_management_failed', { code: 'unexpected_error' });
    return { ok: false, message: 'Não foi possível concluir a operação.' };
  }
}
