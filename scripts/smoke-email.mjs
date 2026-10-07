import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { Webhook } from 'standardwebhooks';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.SUPABASE_URL).hostname))
  throw new Error('O smoke de e-mail só pode usar Supabase local.');
const base = 'http://localhost:3001';
const secret = `whsec_${randomBytes(32).toString('base64')}`;
const verifier = new Webhook(secret);
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3001'], {
  stdio: 'ignore', windowsHide: true,
  env: { ...process.env, APP_ENV: 'local', APP_URL: base, ENABLE_EMAIL: 'true', EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '54325', SMTP_SECURE: 'false', SMTP_USER: '', SMTP_PASSWORD: '',
    SUPABASE_SEND_EMAIL_HOOK_SECRET: `v1,${secret}` },
});
const suffix = randomBytes(8).toString('hex');
const email = `email-smoke-${suffix}@example.test`;
const password = `Teste!${randomBytes(20).toString('base64url')}`;
let userId; let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('O servidor temporário não iniciou. Confira a porta 3001.');
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Servidor temporário indisponível');
  const ticket = randomBytes(32).toString('hex');
  const prepared = await service.rpc('prepare_candidate_signup', { p_origin_key: randomBytes(32).toString('hex'),
    p_email_key: randomBytes(32).toString('hex'), p_email: email, p_cpf: '52998224725', p_birth_date: '1995-06-15',
    p_ticket_hash: createHash('sha256').update(ticket).digest('hex') });
  assert.ok(!prepared.error && prepared.data, 'Cadastro fictício não autorizado');
  const first = await service.auth.admin.generateLink({ type: 'signup', email, password, options: { data: { registration_ticket: ticket } } });
  assert.ok(!first.error && first.data.user && first.data.properties, 'Link fictício não criado');
  userId = first.data.user.id;
  const messages = () => fetch('http://127.0.0.1:54324/api/v1/messages').then(r => r.json());
  const initial = new Set((await messages()).messages.map(item => item.ID));
  async function deliver(properties, action, id) {
    const body = JSON.stringify({ user: { id: userId, email }, email_data: {
      email_action_type: action, token_hash: properties.hashed_token, token: properties.email_otp } });
    const date = new Date();
    const headers = { 'content-type': 'application/json', 'webhook-id': id,
      'webhook-timestamp': String(Math.floor(date.getTime() / 1000)), 'webhook-signature': verifier.sign(id, date, body) };
    const response = await fetch(`${base}/api/auth/send-email`, { method: 'POST', headers, body });
    assert.equal(response.status, 200, 'Hook local não aceitou o envio');
    return { body, headers };
  }
  const delivered = await deliver(first.data.properties, 'signup', `signup-${suffix}`);
  const after = (await messages()).messages.filter(item => !initial.has(item.ID));
  assert.equal(after.length, 1, 'Confirmação não chegou ao Mailpit');
  const detail = await fetch(`http://127.0.0.1:54324/api/v1/message/${after[0].ID}`).then(r => r.json());
  const link = detail.Text.match(/http:\/\/localhost:3001\/auth\/confirm\?[^\s]+/)?.[0];
  assert.ok(link, 'Link da aplicação ausente');
  assert.equal((await fetch(`${base}/api/auth/send-email`, { method: 'POST', ...delivered })).status, 200);
  assert.equal((await messages()).messages.filter(item => !initial.has(item.ID)).length, 1, 'Retry duplicou e-mail');
  assert.equal((await fetch(`${base}/api/auth/send-email`, {
    method: 'POST', body: delivered.body, headers: { 'content-type': 'application/json' },
  })).status, 401, 'Hook sem assinatura não foi bloqueado');

  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH
    || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage();
  await page.goto(link);
  await page.getByRole('button', { name: 'Confirmar e continuar' }).waitFor();
  assert.ok(!(await service.auth.admin.getUserById(userId)).data.user.email_confirmed_at,
    'GET consumiu a confirmação antes do clique');
  await page.getByRole('button', { name: 'Confirmar e continuar' }).click();
  await page.waitForURL(`${base}/candidato`, { timeout: 15000 });
  assert.ok((await service.auth.admin.getUserById(userId)).data.user.email_confirmed_at, 'E-mail não confirmado');

  // Codes from the Account screen share the SMTP/Graph adapter; test the actual
  // local page and RPC while keeping all corporate credentials out of this smoke.
  await page.goto(`${base}/candidato/conta`);
  await page.getByRole('button', { name: 'Enviar código por e-mail' }).click();
  await page.getByText('Enviamos um código').waitFor();
  const account = (await messages()).messages.find(item => !initial.has(item.ID)
    && item.Subject === 'Código de confirmação da conta Herbamed');
  assert.ok(account, 'Código de Conta não entregue');
  const recovery = await service.auth.admin.generateLink({ type: 'recovery', email });
  assert.ok(!recovery.error && recovery.data.properties, 'Recuperação fictícia não criada');
  await deliver(recovery.data.properties, 'recovery', `recovery-${suffix}`);
  await page.goto(`${base}/auth/confirm?token_hash=${recovery.data.properties.hashed_token}&type=recovery`);
  await page.getByRole('button', { name: 'Confirmar e continuar' }).click();
  await page.waitForURL(`${base}/nova-senha`, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Defina uma nova senha.' }).waitFor();
  console.log('PASS: hook assinado, bloqueio sem assinatura, recibo/retry, confirmação por POST, recuperação e código de Conta no Mailpit.');
} finally {
  await browser?.close();
  if (userId) await service.auth.admin.deleteUser(userId);
  server.kill();
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
