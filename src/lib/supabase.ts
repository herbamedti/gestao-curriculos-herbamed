import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { backendConfig } from './config';
import type { Database } from './database.types';
export async function db() {
  const jar = await cookies();
  const env = backendConfig();
  return createServerClient<Database>(env.url, env.key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.APP_URL?.startsWith('https://') ?? false },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => { try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* Read-only RSC: session refreshed in proxy. */ } },
    },
  });
}
