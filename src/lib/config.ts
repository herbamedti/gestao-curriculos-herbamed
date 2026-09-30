import 'server-only';
import { z } from 'zod';
export const config = {
  name: process.env.APP_NAME || 'Herbamed Carreiras',
  url: process.env.APP_URL || 'http://localhost:3000',
  environment: process.env.APP_ENV || 'local',
};
export function backendConfig() {
  return z.object({ url: z.url(), key: z.string().min(10) }).parse({
    url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY,
  });
}
export function isConfigured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY); }
