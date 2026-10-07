import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { chromium } from '@playwright/test';

process.loadEnvFile('.env.local');
for (const key of ['SUPABASE_URL', 'DATABASE_URL'])
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env[key]).hostname))
    throw new Error('Teste exclusivo do banco local.');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const database = new Client({ connectionString: process.env.DATABASE_URL });
const base = 'http://127.0.0.1:3001';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'],
  { env: { ...process.env, APP_URL: base }, stdio: 'ignore', windowsHide: true },
);
const token = randomBytes(6).toString('hex');
const password = `Test!${randomBytes(18).toString('base64url')}`;
let user,
  browser,
  page,
  originalActive = [];
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase()]
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
try {
  await database.connect();
  await mkdir('artifacts/privacy-policy', { recursive: true });
  originalActive = (
    await database.query('select id from public.privacy_policies where active')
  ).rows.map((row) => row.id);
  const created = await admin.auth.admin.createUser({
    email: `privacy.${token}@example.test`,
    password,
    email_confirm: true,
  });
  assert.equal(created.error, null);
  user = created.data.user;
  // Reviewed, fictional local fixture; publication itself always goes through the RPC.
  await database.query(
    'insert into public.staff(user_id,display_name,password_login_enabled) values($1,$2,true)',
    [user.id, 'Gestor fictício'],
  );
  await database.query(
    "insert into public.staff_roles(user_id,role_id) select $1,id from public.roles where name='Superadministrador'",
    [user.id],
  );
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${base}/entrar`)).ok) break;
    } catch {
      /* Starting. */
    }
    if (server.exitCode !== null || attempt === 59)
      throw new Error('Servidor do teste não iniciou.');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`${base}/entrar`);
  await page.getByLabel('E-mail').fill(user.email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'), { timeout: 30000 });
  await page.getByRole('button', { name: 'Configurar autenticador', exact: true }).click();
  const secret = await page.locator('code').innerText();
  await page.getByLabel('Código de seis dígitos').fill(totp(secret));
  await page.getByRole('button', { name: 'Confirmar código', exact: true }).click();
  await page.waitForURL('**/rh', { timeout: 30000 });
  await page.goto(`${base}/rh/privacidade`);
  const firstVersion = `smoke-${token}-01`,
    secondVersion = `smoke-${token}-02`;
  const heading =
    '# Aviso fictício\n\n**Versão:** teste\n\n## Direitos\n- Primeiro direito\n- Segundo direito\n\n';
  const body =
    heading +
    'Parágrafo fictício para verificar a publicação integral de um aviso extenso.\n\n'.repeat(350) +
    '<script>window.__noticeExecuted=true</script>\n\nFim do aviso fictício.';
  assert.ok(body.length > 22545);
  const form = page.locator('.policy-editor');
  await form.getByLabel('Nova versão').fill(firstVersion);
  await form.getByLabel('Título do aviso').fill('Aviso extenso fictício');
  await form.getByLabel('Texto integral aprovado').fill(body);
  assert.equal(
    await form.getByLabel('Texto integral aprovado').inputValue(),
    body,
    'Texto não é truncado pelo formulário',
  );
  await form.getByRole('checkbox').check();
  await page.screenshot({ path: 'artifacts/privacy-policy/editor-desktop.png', fullPage: true });
  await form.getByRole('button', { name: 'Publicar nova versão', exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get('publicado') === '1', { timeout: 30000 });
  await page.getByRole('status').filter({ hasText: 'Nova versão publicada' }).waitFor();
  const first = (
    await database.query('select id,body from public.privacy_policies where version=$1', [
      firstVersion,
    ])
  ).rows[0];
  assert.equal(first.body, body);
  const publicPage = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await publicPage.goto(`${base}/privacidade`);
  await publicPage.getByRole('heading', { name: 'Direitos', exact: true }).waitFor();
  assert.equal(await publicPage.locator('.policy-body li').count(), 2);
  assert.ok(
    (await publicPage.locator('.policy-body').innerText()).includes('Fim do aviso fictício.'),
  );
  assert.equal(await publicPage.evaluate(() => window.__noticeExecuted), undefined);
  assert.equal(await publicPage.locator('.policy-body script').count(), 0);
  await publicPage.screenshot({ path: 'artifacts/privacy-policy/public-desktop.png' });
  await publicPage.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
  await publicPage.screenshot({ path: 'artifacts/privacy-policy/public-mobile.png' });
  await publicPage.close();

  // Failed duplicate publication must retain the draft and the current notice.
  const revision = body + '\n\nAlteração fictícia.';
  await form.getByLabel('Nova versão').fill(firstVersion);
  await form.getByLabel('Texto integral aprovado').fill(revision);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Publicar nova versão', exact: true }).click();
  await form.getByRole('alert').filter({ hasText: 'Esta versão já foi publicada' }).waitFor();
  assert.equal(await form.getByLabel('Texto integral aprovado').inputValue(), revision);
  assert.equal(await form.getByLabel('Nova versão').inputValue(), firstVersion);
  const excess = 'x'.repeat(100001);
  await form.getByLabel('Nova versão').fill(secondVersion);
  await form.getByLabel('Texto integral aprovado').fill(excess);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Publicar nova versão', exact: true }).click();
  await form.getByRole('alert').filter({ hasText: 'até 100.000 caracteres' }).waitFor();
  assert.equal(await form.getByLabel('Texto integral aprovado').inputValue(), excess);
  await form.getByLabel('Texto integral aprovado').fill(revision);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Publicar nova versão', exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get('aviso') !== first.id, { timeout: 30000 });
  await page.getByRole('status').filter({ hasText: 'Nova versão publicada' }).waitFor();
  assert.equal(
    (await database.query('select body from public.privacy_policies where id=$1', [first.id]))
      .rows[0].body,
    body,
  );
  await page
    .locator('.policy-history li')
    .filter({ hasText: `Versão ${firstVersion}` })
    .getByRole('link')
    .click();
  await page.waitForURL((url) => url.searchParams.get('aviso') === first.id);
  assert.equal(await form.getByLabel('Texto integral aprovado').inputValue(), body);
  assert.equal(await form.getByLabel('Nova versão').inputValue(), '');
  await page.locator('.policy-history-preview summary').click();
  assert.ok(
    (await page.locator('.policy-history-preview .policy-body').innerText()).includes(
      'Fim do aviso fictício.',
    ),
  );
  await page.locator('.policy-history-preview summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: 'artifacts/privacy-policy/history-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/privacy-policy/history-desktop.png', fullPage: true });
  await database.query(
    "insert into public.privacy_policies(version,title,body,published_at,active) select $1||'-page-'||i,'Histórico fictício','Texto fictício de histórico.',now()-interval '1 day',false from generate_series(1,20) i",
    [`smoke-${token}`],
  );
  await page.reload();
  assert.equal(await page.locator('.policy-history li').count(), 20);
  await page
    .locator('#historico-avisos .pagination')
    .getByRole('link', { name: 'Próxima' })
    .click();
  await page.waitForURL((url) => url.searchParams.get('pagina') === '2');
  assert.ok((await page.locator('.policy-history li').count()) <= 20);
  assert.equal(
    await form.getByLabel('Texto integral aprovado').inputValue(),
    body,
    'Navegação do histórico conserva a versão selecionada',
  );
  await page
    .locator('#historico-avisos .pagination')
    .getByRole('link', { name: 'Anterior' })
    .click();
  await page.waitForURL((url) => url.searchParams.get('pagina') === '1');
  assert.deepEqual(errors, []);
  console.log(
    'Aviso extenso, erros sem perda do rascunho, histórico, texto seguro e layouts desktop/mobile aprovados.',
  );
} catch (error) {
  await page?.screenshot({ path: 'artifacts/privacy-policy/failure.png', fullPage: true });
  throw error;
} finally {
  await browser?.close();
  server.kill();
  // Restore only local fixture publications and the original active IDs.
  await database.query('begin');
  try {
    await database.query('delete from public.privacy_policies where version like $1', [
      `smoke-${token}-%`,
    ]);
    if (originalActive.length)
      await database.query(
        'update public.privacy_policies set active=true where id=any($1::uuid[])',
        [originalActive],
      );
    await database.query('commit');
  } catch (error) {
    await database.query('rollback');
    throw error;
  }
  if (user) await admin.auth.admin.deleteUser(user.id);
  await database.end();
}
