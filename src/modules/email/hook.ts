import { createHash } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { z } from 'zod';
import { authMessages } from './auth-messages';
import { mailFailureCode, webhookSecret, type MailMessage } from './settings';

export type DeliveryClaim = { state: 'claimed'; lease: string } | { state: 'sent' | 'busy' };
type Dependencies = {
  enabled: boolean; secret: string | undefined; appUrl: string;
  claim: (key: string) => Promise<DeliveryClaim>;
  finish: (key: string, lease: string, sent: boolean) => Promise<void>;
  send: (message: MailMessage, signal: AbortSignal) => Promise<void>;
  diagnostic: (code: string) => void;
};
export function emailHook(deps: Dependencies) {
  return async function POST(request: Request) {
    const response = (status: number) => Response.json(status === 200 ? {} : {
      error: { http_code: status, message: 'Não foi possível processar o envio de e-mail.' },
    }, { status, headers: { 'Cache-Control': 'no-store' } });
    if (!deps.enabled) return response(503);
    let verifier;
    try { verifier = new Webhook(webhookSecret(deps.secret)); }
    catch { deps.diagnostic('mail_configuration_invalid'); return response(503); }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return response(415);
    // Bound streamed input too: Content-Length is optional and cannot be trusted.
    let body = '';
    const reader = request.body?.getReader();
    if (!reader) return response(400);
    try {
      const parts: Uint8Array[] = []; let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 65536) { await reader.cancel(); return response(413); }
        parts.push(value);
      }
      body = Buffer.concat(parts).toString('utf8');
    } catch { return response(400); }
    let payload: unknown;
    const id = request.headers.get('webhook-id') || '';
    try {
      z.string().min(1).max(256).parse(id);
      z.string().regex(/^\d{1,12}$/).parse(request.headers.get('webhook-timestamp'));
      payload = verifier.verify(body, Object.fromEntries(request.headers));
    } catch { deps.diagnostic('mail_hook_signature_rejected'); return response(401); }
    let messages;
    try { messages = authMessages(payload, deps.appUrl); }
    catch { deps.diagnostic('mail_hook_payload_rejected'); return response(400); }
    const signal = AbortSignal.timeout(4000);
    try {
      const results = await Promise.allSettled(messages.map(async (message, index) => {
        const key = createHash('sha256').update(`${id}\n${body}\n${index}`).digest('hex');
        const claim = await deps.claim(key);
        if (claim.state !== 'claimed') {
          if (claim.state === 'sent') return;
          throw new Error('mail_hook_busy');
        }
        try { await deps.send(message, signal); }
        catch (error) { await deps.finish(key, claim.lease, false); throw error; }
        await deps.finish(key, claim.lease, true);
      }));
      const failed = results.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      return response(200);
    } catch (error) {
      deps.diagnostic(mailFailureCode(error));
      return response(503);
    }
  };
}
