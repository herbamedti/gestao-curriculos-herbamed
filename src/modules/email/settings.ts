import { z } from 'zod';

const graphSchema = z.object({
  provider: z.literal('microsoft_graph'),
  tenantId: z.uuid(),
  clientId: z.uuid(),
  clientSecret: z.string().min(1).max(2048),
  sender: z.email().max(254),
});
const smtpSchema = z.object({
  provider: z.literal('smtp'),
  host: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.enum(['true', 'false']).transform(value => value === 'true'),
  user: z.string().optional(),
  password: z.string().optional(),
  from: z.string().trim().min(1).max(320).refine(value => !/[\r\n]/.test(value)),
});
export type GraphSettings = z.infer<typeof graphSchema>;
export type MailSettings = GraphSettings | z.infer<typeof smtpSchema>;

export function mailSettings(env: Record<string, string | undefined>): MailSettings {
  const provider = z.enum(['smtp', 'microsoft_graph']).parse(env.EMAIL_PROVIDER || 'smtp');
  if (provider === 'microsoft_graph') return graphSchema.parse({
    provider, tenantId: env.MS_GRAPH_TENANT_ID, clientId: env.MS_GRAPH_CLIENT_ID,
    clientSecret: env.MS_GRAPH_CLIENT_SECRET, sender: env.MS_GRAPH_SENDER,
  });
  return smtpSchema.parse({
    provider, host: env.SMTP_HOST, port: env.SMTP_PORT || '25',
    secure: env.SMTP_SECURE || 'false', user: env.SMTP_USER || undefined,
    password: env.SMTP_PASSWORD || undefined,
    from: env.SMTP_FROM || 'Herbamed Carreiras <no-reply@example.test>',
  });
}

export const mailSchema = z.object({
  to: z.email().max(254),
  subject: z.string().min(1).max(200).refine(value => !/[\r\n]/.test(value)),
  text: z.string().min(1).max(20000),
});
export type MailMessage = z.infer<typeof mailSchema>;

export function mailFailureCode(error: unknown) {
  const code = z.enum(['mail_rate_limited', 'mail_credentials_rejected', 'mail_permission_denied',
    'mail_provider_unavailable', 'mail_invalid_token_response', 'mail_timeout', 'mail_disabled',
    'mail_configuration_invalid']).safeParse(error instanceof Error && 'code' in error ? error.code : undefined);
  return code.success ? code.data : 'mail_hook_delivery_failed';
}

// Supabase supplies v1,whsec_<base64>; Standard Webhooks expects whsec_<base64>.
export function webhookSecret(value: string | undefined) {
  const secret = z.string().regex(/^(?:v1,)?whsec_[A-Za-z0-9+/]+={0,2}$/).parse(value);
  const normalized = secret.replace(/^v1,/, '');
  if (Buffer.from(normalized.slice(6), 'base64').length < 32) throw new Error('invalid_hook_secret');
  return normalized;
}
