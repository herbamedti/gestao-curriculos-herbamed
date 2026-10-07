import { z } from 'zod';
import { config, features } from '@/lib/config';
import { serviceDb } from '@/lib/service-db';
import { log } from '@/lib/logger';
import { emailHook } from '@/modules/email/hook';
import { sendEmail } from '@/modules/email/sender';

export const runtime = 'nodejs';
const claimSchema = z.union([
  z.object({ state: z.literal('claimed'), lease: z.uuid() }),
  z.object({ state: z.enum(['sent', 'busy']) }),
]);
export async function POST(request: Request) {
  const service = serviceDb();
  return emailHook({
    enabled: features.email && Boolean(service), secret: process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET,
    appUrl: config.url,
    async claim(key) {
      const result = await service!.rpc('claim_email_delivery', { p_key: key }).abortSignal(AbortSignal.timeout(1000));
      if (result.error) throw new Error('mail_receipt_unavailable');
      return claimSchema.parse(result.data);
    },
    async finish(key, lease, sent) {
      const result = await service!.rpc('finish_email_delivery', { p_key: key, p_lease: lease, p_sent: sent }).abortSignal(AbortSignal.timeout(1000));
      if (result.error || !result.data) throw new Error('mail_receipt_unavailable');
    },
    send: sendEmail, diagnostic: code => log('email.auth_hook', { code }),
  })(request);
}
