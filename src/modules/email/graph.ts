import 'server-only';
import { z } from 'zod';
import { mailSchema, type GraphSettings, type MailMessage } from './settings';

export class MailDeliveryError extends Error {
  constructor(public readonly code: string) { super(code); }
}

// No response bodies or provider messages escape this adapter: they can include PII.
function failure(status: number) {
  return new MailDeliveryError(status === 429 ? 'mail_rate_limited'
    : status === 401 ? 'mail_credentials_rejected'
    : status === 403 ? 'mail_permission_denied' : 'mail_provider_unavailable');
}

export function graphMailer(settings: GraphSettings, request: typeof fetch = fetch, now = Date.now) {
  let cached: { value: string; expires: number } | undefined;
  let pending: Promise<string> | undefined;
  async function token(signal: AbortSignal): Promise<string> {
    if (cached && cached.expires > now()) return cached.value;
    if (pending) return pending;
    pending = (async () => {
      const response = await request(`https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/token`, {
        method: 'POST', cache: 'no-store', redirect: 'error', signal,
        body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret,
          grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
      });
      if (!response.ok) throw failure(response.status);
      const result = z.object({ access_token: z.string().min(1), token_type: z.literal('Bearer'),
        expires_in: z.number().int().positive().max(86400) }).safeParse(await response.json());
      if (!result.success) throw new MailDeliveryError('mail_invalid_token_response');
      cached = { value: result.data.access_token, expires: now() + Math.max(0, result.data.expires_in - 60) * 1000 };
      return cached.value;
    })();
    try { return await pending; } finally { pending = undefined; }
  }
  return {
    async send(message: MailMessage, signal = AbortSignal.timeout(4000)) {
      const mail = mailSchema.parse(message);
      try {
        const accessToken = await token(signal);
        const response = await request(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(settings.sender)}/sendMail`, {
          method: 'POST', cache: 'no-store', redirect: 'error', signal,
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { subject: mail.subject, body: { contentType: 'Text', content: mail.text },
            toRecipients: [{ emailAddress: { address: mail.to } }] }, saveToSentItems: true }),
        });
        if (response.status === 401) cached = undefined;
        if (response.status !== 202) throw failure(response.status);
        // 202 means accepted by Exchange, not final inbox delivery. Do not retry an
        // ambiguous timeout here: sendMail has no idempotency key.
      } catch (error) {
        if (error instanceof MailDeliveryError) throw error;
        throw new MailDeliveryError(signal.aborted ? 'mail_timeout' : 'mail_provider_unavailable');
      }
    },
  };
}
