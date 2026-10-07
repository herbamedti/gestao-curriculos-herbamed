// Fail a hosted build before publishing a site wired to localhost or without
// the account and anti-bot services needed by the active application flows.
const hosted = process.env.VERCEL === '1' || ['demo', 'production'].includes(process.env.APP_ENV);
if (hosted) {
  const required = [
    'APP_ENV', 'APP_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  const turnstile = process.env.ENABLE_TURNSTILE === 'true' || (process.env.ENABLE_TURNSTILE === undefined && process.env.APP_ENV !== 'demo');
  const email = process.env.ENABLE_EMAIL === 'true' || (process.env.ENABLE_EMAIL === undefined && process.env.APP_ENV !== 'demo');
  if (turnstile) required.push('TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY');
  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  if (email && provider === 'smtp') required.push('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM');
  if (email && provider === 'microsoft_graph') required.push('MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID',
    'MS_GRAPH_CLIENT_SECRET', 'MS_GRAPH_SENDER', 'SUPABASE_SEND_EMAIL_HOOK_SECRET');
  const errors = required.filter(key => !process.env[key]?.trim()).map(key => `${key} ausente`);
  for (const key of ['ENABLE_TURNSTILE', 'ENABLE_EMAIL']) {
    if (process.env[key] !== undefined && !['true', 'false'].includes(process.env[key])) errors.push(`${key} deve ser true ou false`);
  }
  if (!['demo', 'production'].includes(process.env.APP_ENV)) errors.push('APP_ENV deve ser demo ou production');
  if (!['smtp', 'microsoft_graph'].includes(provider)) errors.push('EMAIL_PROVIDER deve ser smtp ou microsoft_graph');
  if (email && provider === 'microsoft_graph') {
    for (const key of ['MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID']) {
      if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(process.env[key] || '')) errors.push(`${key} deve ser UUID`);
    }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(process.env.MS_GRAPH_SENDER || '')) errors.push('MS_GRAPH_SENDER deve ser e-mail simples');
    const secret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET || '';
    if (!/^(?:v1,)?whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)
      || Buffer.from(secret.replace(/^(?:v1,)?whsec_/, ''), 'base64').length < 32)
      errors.push('SUPABASE_SEND_EMAIL_HOOK_SECRET inválido');
  }
  for (const key of ['APP_URL', 'SUPABASE_URL']) {
    try {
      const value = new URL(process.env[key]);
      if (value.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(value.hostname))
        errors.push(`${key} deve ser HTTPS remoto`);
    } catch { errors.push(`${key} deve ser uma URL válida`); }
  }
  const port = Number(process.env.SMTP_PORT);
  if (email && provider === 'smtp' && (!Number.isInteger(port) || port < 1 || port > 65535)) errors.push('SMTP_PORT inválida');
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
