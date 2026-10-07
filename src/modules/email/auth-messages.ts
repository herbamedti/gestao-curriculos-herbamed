import { z } from 'zod';
import type { MailMessage } from './settings';

export const confirmationSchema = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
  type: z.enum(['signup', 'recovery', 'invite', 'magiclink', 'email_change']),
});
const hash = confirmationSchema.shape.token_hash;
const optionalHash = z.union([hash, z.literal('')]).optional();
const otp = z.string().regex(/^[A-Za-z0-9]{6,10}$/);
export const authEmailSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.email().max(254), new_email: z.union([z.email().max(254), z.literal('')]).optional() }),
  email_data: z.object({
    email_action_type: z.enum(['signup', 'recovery', 'invite', 'magiclink', 'email_change', 'reauthentication']),
    token_hash: optionalHash, token_hash_new: optionalHash,
    token: z.union([otp, z.literal('')]).optional(), token_new: z.union([otp, z.literal('')]).optional(),
  }),
});

export function authMessages(payload: unknown, appUrl: string): MailMessage[] {
  const { user, email_data: data } = authEmailSchema.parse(payload);
  const base = new URL(appUrl);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('invalid_app_url');
  // Never build links from redirect_to/site_url/user metadata in the webhook.
  const link = (tokenHash: string, type: z.infer<typeof confirmationSchema>['type']) => {
    const url = new URL('/auth/confirm', base);
    url.search = new URLSearchParams({ token_hash: hash.parse(tokenHash), type }).toString();
    return url.toString();
  };
  const message = (to: string, subject: string, text: string): MailMessage => ({
    to, subject, text: `${text}\n\nSe você não solicitou esta ação, ignore esta mensagem.\nHerbamed Carreiras`,
  });
  if (data.email_action_type === 'reauthentication') return [message(user.email,
    'Código de verificação Herbamed', `Seu código de verificação é ${otp.parse(data.token)}.`)];
  if (data.email_action_type === 'email_change') {
    const nextEmail = z.email().max(254).parse(user.new_email);
    // Secure Email Change reverses the hash field names: _new belongs to current email.
    if (!data.token_hash_new) throw new Error('secure_email_change_required');
    return [
      message(user.email, 'Confirme a alteração do e-mail Herbamed', `Confirme a alteração pelo e-mail atual:\n${link(data.token_hash_new, 'email_change')}`),
      message(nextEmail, 'Confirme seu novo e-mail Herbamed', `Confirme o novo endereço para concluir a alteração:\n${link(hash.parse(data.token_hash), 'email_change')}`),
    ];
  }
  const templates = {
    signup: ['Confirme seu cadastro Herbamed', 'Confirme seu endereço de e-mail para concluir o cadastro:'],
    recovery: ['Recuperação de senha Herbamed', 'Acesse o link para definir uma nova senha:'],
    invite: ['Convite para a plataforma Herbamed', 'Acesse o link para aceitar seu convite e definir uma senha:'],
    magiclink: ['Seu acesso à plataforma Herbamed', 'Confirme seu acesso pelo link:'],
  } as const;
  const [subject, text] = templates[data.email_action_type];
  return [message(user.email, subject, `${text}\n${link(hash.parse(data.token_hash), data.email_action_type)}`)];
}
