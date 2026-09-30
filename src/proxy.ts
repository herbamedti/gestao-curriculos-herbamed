import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const development = process.env.NODE_ENV === 'development';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${development ? "'unsafe-eval'" : ''} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${development ? 'ws: http://localhost:* http://127.0.0.1:*' : ''} https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce); headers.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers } });
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const client = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      cookieOptions: { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:' },
      cookies: { getAll: () => request.cookies.getAll(), setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers } });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      } },
    });
    if (request.cookies.getAll().some(c => c.name.startsWith('sb-'))) await client.auth.getUser();
  }
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|brand/|favicon.ico|api/health).*)'] };
