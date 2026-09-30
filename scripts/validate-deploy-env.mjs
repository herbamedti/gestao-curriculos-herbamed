// Fail a hosted build before publishing a site wired to localhost or without
// the account and anti-bot services needed by the active application flows.
const hosted = process.env.VERCEL === '1' || ['demo', 'production'].includes(process.env.APP_ENV);
if (hosted) {
  const required = [
    'APP_ENV', 'APP_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM',
  ];
  const errors = required.filter(key => !process.env[key]?.trim()).map(key => `${key} ausente`);
  if (!['demo', 'production'].includes(process.env.APP_ENV)) errors.push('APP_ENV deve ser demo ou production');
  for (const key of ['APP_URL', 'SUPABASE_URL']) {
    try {
      const value = new URL(process.env[key]);
      if (value.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(value.hostname))
        errors.push(`${key} deve ser HTTPS remoto`);
    } catch { errors.push(`${key} deve ser uma URL válida`); }
  }
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('SMTP_PORT inválida');
  if (process.env.ENABLE_LEGACY_STORAGE_UPLOADS === 'true') errors.push('uploads legados devem permanecer desativados');
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== process.env.SUPABASE_URL)
    errors.push('NEXT_PUBLIC_SUPABASE_URL deve apontar ao mesmo projeto Supabase');
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== process.env.SUPABASE_ANON_KEY)
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY deve usar a mesma chave publishable');
  if (errors.length) {
    console.error(`Configuração de deploy incompleta: ${errors.join('; ')}.`);
    process.exit(1);
  }
  console.log('Configuração de deploy validada.');
}
