import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

process.loadEnvFile('.env.local');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.SUPABASE_URL).hostname))
  throw new Error('Este smoke só pode usar Supabase local.');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const base = 'http://127.0.0.1:3001';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3001'], {
  env: { ...process.env, APP_ENV: 'demo', APP_URL: base, ENABLE_EMAIL: 'false', ENABLE_TURNSTILE: 'false' },
  stdio: 'ignore', windowsHide: true,
});
let browser;
let userId;
const email = `demo.${randomBytes(6).toString('hex')}@example.test`;
const password = `Test!${randomBytes(18).toString('base64url')}`;
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase()].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
try {
  for (let i=0; i<90; i++) {
    try { const response = await fetch(`${base}/entrar`); if (response.ok) break; } catch { /* Server is starting. */ }
    if (server.exitCode !== null || i === 89) throw new Error('Servidor de smoke não iniciou.');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const page = await browser.newPage();
  await page.goto(`${base}/entrar`);
  assert.equal(await page.getByRole('link',{name:'Esqueci minha senha'}).count(),0);
  assert.equal(await page.locator('script[src*="challenges.cloudflare.com"]').count(),0);
  await page.goto(`${base}/recuperar-senha`);
  await page.getByText(/A recuperação por e-mail está temporariamente desativada/).waitFor();
  assert.equal(await page.getByRole('button',{name:'Enviar instruções'}).count(),0);
  await page.goto(`${base}/criar-conta`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();
  await page.waitForURL('**/candidato',{timeout:30000});
  const signedIn = await client.auth.signInWithPassword({email,password});
  assert.equal(signedIn.error,null);
  userId = signedIn.data.user.id;
  assert.ok(signedIn.data.user.email_confirmed_at);
  assert.equal((await client.rpc('is_staff')).data,false);
  await page.goto(`${base}/candidato/conta`);
  assert.equal(await page.getByRole('button',{name:'Enviar código por e-mail'}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Solicitar alteração do e-mail'}).count(),0);
  await page.getByText('Configure o aplicativo autenticador abaixo para confirmar a alteração da senha.').waitFor();
  await page.getByRole('button',{name:'Configurar autenticador',exact:true}).click();
  const secretNode = page.locator('.card code');
  await secretNode.waitFor();
  const secret = await secretNode.innerText();
  await page.getByLabel('Código de seis dígitos').fill(totp(secret));
  await page.getByRole('button',{name:'Confirmar código',exact:true}).click();
  await page.getByRole('button',{name:'Alterar senha',exact:true}).waitFor({timeout:30000});
  assert.deepEqual(await page.locator('select[name="method"] option').evaluateAll(options => options.map(o=>o.value)),['authenticator']);
  const changed = `New!${randomBytes(18).toString('base64url')}`;
  await page.locator('input[name="password"]').fill(changed);
  await page.locator('input[name="confirm_password"]').fill(changed);
  await page.locator('form').filter({has:page.locator('input[name="confirm_password"]')}).locator('input[name="code"]').fill(totp(secret));
  await page.getByRole('button',{name:'Alterar senha',exact:true}).click();
  await page.waitForURL('**/entrar',{timeout:30000});
  assert.equal((await client.auth.signInWithPassword({email,password:changed})).error,null);
  console.log('Demo local: cadastro e login sem e-mail, Turnstile ausente, recuperação desativada e troca de senha por autenticador: OK.');
} finally {
  await browser?.close();
  if (userId) {
    const admin = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) throw new Error('Não foi possível remover o usuário fictício do smoke.');
  }
  server.kill();
}
