import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function signupQuotaKeys(headers: Headers, secret: string, email: string, vercel: boolean) {
  // Only trust headers written by the hosting platform. Other deployments share
  // a conservative quota unless a trusted ingress is explicitly implemented.
  const raw = vercel ? headers.get('x-vercel-forwarded-for') || headers.get('x-forwarded-for') : null;
  const ip = raw?.trim();
  const origin = ip && isIP(ip) ? ip : 'shared-origin';
  const digest = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
  return { origin: digest(`signup-origin:${origin}`), email: digest(`signup-email:${email.toLowerCase()}`) };
}
