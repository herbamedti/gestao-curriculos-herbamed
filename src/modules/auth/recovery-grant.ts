import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/supabase';
import { serviceDb } from '@/lib/service-db';

const cookieName = 'herbamed-password-recovery';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

// Called exclusively after verifyOtp(recovery/invite) succeeds, never after a
// normal password/OAuth login or a client-controlled callback query parameter.
export async function issueRecoveryGrant() {
  const client = await db();
  const service = serviceDb();
  const { data, error } = await client.auth.getClaims();
  const claims = z.object({ sub: z.uuid(), session_id: z.uuid() }).safeParse(data?.claims);
  if (error || !claims.success || !service) throw new Error('recovery_unavailable');
  const token = randomBytes(32).toString('hex');
  const result = await service.rpc('issue_password_recovery_grant', {
    p_user_id: claims.data.sub, p_session_id: claims.data.session_id, p_token_hash: digest(token),
  });
  if (result.error) throw new Error('recovery_unavailable');
  (await cookies()).set(cookieName, token, {
    httpOnly: true, sameSite: 'strict', secure: process.env.APP_URL?.startsWith('https://') ?? false,
    path: '/', maxAge: 600,
  });
}

export async function consumeRecoveryGrant() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  jar.delete(cookieName);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const client = await db();
  const result = await client.rpc('consume_password_recovery_grant', { p_token_hash: digest(token) });
  return !result.error && result.data === true;
}
