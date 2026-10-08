import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { chromium, expect } from '@playwright/test';

process.loadEnvFile('.env.local');
for (const key of ['SUPABASE_URL', 'DATABASE_URL']) {
  assert.ok(
    ['localhost', '127.0.0.1'].includes(new URL(process.env[key]).hostname),
    'Teste restrito aos serviços locais.',
  );
}
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
const password = `Test!${randomBytes(18).toString('base64url')}`;
const token = randomBytes(5).toString('hex');
const users = [];
let browser;
let activePage;
const errors = [];
const delay = () => new Promise((resolve) => setTimeout(resolve, 1400));
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
async function login(page, email) {
  await page.goto(`${base}/entrar`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'));
}
async function watchPosts(page, path) {
  let count = 0;
  const matcher = (url) => url.pathname === path;
  await page.route(matcher, async (route) => {
    if (route.request().method() === 'POST') {
      count++;
      await delay();
    }
    await route.continue();
  });
  return { count: () => count, stop: () => page.unroute(matcher) };
}
async function pendingButton(page, label) {
  const button = page.getByRole('button', { name: label, exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('.loading-spinner')).toBeVisible();
  // A second activation must not start another operation.
  await button.evaluate((element) => element.click());
  return button;
}
async function navigation(page, href, mobile = false) {
  const matcher = (url) => url.pathname === href.split('?')[0];
  await page.route(matcher, async (route) => {
    if (route.request().headers()['rsc'] === '1') {
      // Force a cold navigation; production prefetch remains enabled.
      if (route.request().headers()['next-router-prefetch'] === '1') {
        await route.abort();
        return;
      }
      await delay();
    }
    await route.continue();
  });
  const scope = page.locator(mobile ? '.mobile-nav' : '.sidebar');
  if (mobile) await scope.locator('summary').click();
  const link = scope.locator(`a[href="${href}"]`);
  await link.click();
  await expect(link.locator('.link-feedback')).toHaveAttribute('data-pending', 'true');
  await expect(page.locator('.navigation-status')).toHaveText('Carregando página…');
  await expect(page.locator('main.workspace-content')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('main.workspace-content')).toHaveAttribute('inert', '');
  await expect
    .poll(() =>
      page
        .locator('main.workspace-content')
        .evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe('0.55');
  await expect(scope).toBeVisible();
  await page.screenshot({
    path: `artifacts/loading-feedback/navigation-${mobile ? 'mobile' : 'desktop'}.png`,
  });
  if (mobile) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(
      await page
        .locator('.loading-spinner')
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
      'none',
    );
  }
  await page.waitForURL((url) => url.pathname === href);
  await expect(page.locator('.app-feedback')).toHaveAttribute('data-navigating', 'false');
  await expect(page.locator('main.workspace-content')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('main.workspace-content')).not.toHaveAttribute('inert', '');
  await page.unroute(matcher);
}
try {
  await database.connect();
  await mkdir('artifacts/loading-feedback', { recursive: true });
  for (const kind of ['candidate', 'staff']) {
    const email = `loading.${kind}.${token}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(created.error, null);
    users.push({ id: created.data.user.id, email });
  }
  // Reviewed, temporary local staff fixture; no MFA bypass.
  await database.query(
    'insert into public.staff(user_id,display_name,password_login_enabled) values($1,$2,true)',
    [users[1].id, 'Gestor Fictício'],
  );
  await database.query(
    "insert into public.staff_roles(user_id,role_id) select $1,id from public.roles where name='Superadministrador'",
    [users[1].id],
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage = page;
  page.on('pageerror', (error) => errors.push(error.message));
  const postLogin = await watchPosts(page, '/entrar');
  await page.goto(`${base}/entrar`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('E-mail').fill(users[0].email);
  await page.locator('input[name="password"]').fill('IncorrectTest!123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pendingButton(page, 'Entrando…');
  await page.getByRole('alert').waitFor();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  assert.equal(postLogin.count(), 1);
  await page.getByLabel('E-mail').fill(users[0].email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pendingButton(page, 'Entrando…');
  await page.waitForURL('**/candidato');
  assert.equal(postLogin.count(), 2);
  await postLogin.stop();
  console.log('Login com retry e bloqueio de envio repetido: OK.');

  await navigation(page, '/candidato/conta');
  const save = await watchPosts(page, '/candidato/conta');
  await page.getByLabel('Nome completo').fill('Pessoa Fictícia');
  await page.getByRole('button', { name: 'Salvar nome', exact: true }).click();
  await pendingButton(page, 'Salvando…');
  await page.screenshot({ path: 'artifacts/loading-feedback/save-button.png' });
  await page.getByRole('status').filter({ hasText: 'Nome atualizado' }).waitFor();
  await expect(page.getByRole('button', { name: 'Salvar nome', exact: true })).toBeEnabled();
  assert.equal(save.count(), 1);
  await save.stop();

  await page.goto(`${base}/candidato/perfil`);
  await page.getByLabel('Nome completo').fill('Pessoa Fictícia');
  await page.getByLabel('Telefone com DDD').fill('(11) 99999-9999');
  await page.locator('input[name="city"]').fill('Cidade Fictícia');
  await page.getByLabel('Cargo ou área de atuação').fill('Analista fictício');
  await page
    .getByLabel(/Resumo profissional/)
    .fill(
      'Perfil fictício criado somente para verificar o carregamento da exportação do currículo.',
    );
  await page.getByRole('button', { name: 'Salvar dados do currículo', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Alterações salvas' }).waitFor();
  await page.goto(`${base}/candidato/perfil?etapa=revisao`);
  let downloads = 0;
  let fail = true;
  const files = (url) => /\/api\/(my-data|curriculos\/[^/]+\/pdf)$/.test(url.pathname);
  await page.route(files, async (route) => {
    downloads++;
    await delay();
    if (fail) await route.fulfill({ status: 503, body: 'Unavailable' });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Exportar currículo em PDF', exact: true }).click();
  await pendingButton(page, 'Preparando arquivo…');
  await page.getByRole('status').filter({ hasText: 'Não foi possível preparar' }).waitFor();
  await expect(
    page.getByRole('button', { name: 'Exportar currículo em PDF', exact: true }),
  ).toBeEnabled();
  assert.equal(downloads, 1);
  fail = false;
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar currículo em PDF', exact: true }).click();
  await pendingButton(page, 'Preparando arquivo…');
  const pdf = await pdfDownload;
  assert.equal((await readFile(await pdf.path())).subarray(0, 4).toString(), '%PDF');
  assert.equal(downloads, 2);
  await page.goto(`${base}/candidato/privacidade`);
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar JSON', exact: true }).click();
  await pendingButton(page, 'Preparando arquivo…');
  const json = await jsonDownload;
  JSON.parse(await readFile(await json.path(), 'utf8'));
  assert.equal(downloads, 3);
  await page.unroute(files);
  console.log('Salvamento e downloads PDF/JSON com retry: OK.');

  // Query-only tabs and an interrupted navigation must clear feedback as well.
  const interrupted = (url) => url.pathname === '/candidato/candidaturas';
  await page.route(interrupted, async (route) => {
    if (route.request().headers()['next-router-prefetch'] === '1') {
      await route.abort();
      return;
    }
    await delay();
    try {
      await route.continue();
    } catch (error) {
      // Next cancels this request when the user selects another destination.
      if (!error.message.includes('Route is already handled!')) errors.push(error.message);
    }
  });
  await page.goto(`${base}/candidato/perfil?etapa=dados`);
  const tab = (url) =>
    url.pathname === '/candidato/perfil' && url.searchParams.get('etapa') === 'trajetoria';
  await page.route(tab, async (route) => {
    await delay();
    await route.continue();
  });
  await page.getByRole('link', { name: 'Experiência e formação', exact: true }).click();
  await expect(page.locator('.app-feedback')).toHaveAttribute('data-navigating', 'true');
  await page.waitForURL('**/candidato/perfil?etapa=trajetoria');
  await expect(page.locator('.app-feedback')).toHaveAttribute('data-navigating', 'false');
  await page.unroute(tab);
  await page.locator('.sidebar a[href="/candidato/candidaturas"]').click();
  await expect(page.locator('.app-feedback')).toHaveAttribute('data-navigating', 'true');
  await page.locator('.sidebar a[href="/candidato/conta"]').click();
  await page.waitForURL('**/candidato/conta');
  await expect(page.locator('.app-feedback')).toHaveAttribute('data-navigating', 'false');
  await page.unroute(interrupted);
  console.log('Abas e navegação substituída sem carregamento preso: OK.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/candidato`);
  await navigation(page, '/candidato/mensagens', true);

  const staff = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage = staff;
  staff.on('pageerror', (error) => errors.push(error.message));
  await login(staff, users[1].email);
  const mfa = await watchPosts(staff, new URL(staff.url()).pathname);
  await staff.getByRole('button', { name: 'Configurar autenticador', exact: true }).click();
  await pendingButton(staff, 'Preparando…');
  const secret = await staff.locator('code').innerText();
  await staff.getByLabel('Código de seis dígitos').fill(totp(secret));
  await staff.getByRole('button', { name: 'Confirmar código', exact: true }).click();
  await pendingButton(staff, 'Verificando…');
  await staff.waitForURL('**/rh');
  assert.equal(mfa.count(), 2);
  await mfa.stop();
  console.log('Menu móvel e MFA: OK.');
  await navigation(staff, '/rh/vagas');
  await staff.goto(`${base}/rh/candidatos`);
  const csvFile = (url) => url.pathname === '/api/rh/export-candidates';
  await staff.route(csvFile, async (route) => {
    await delay();
    await route.continue();
  });
  const csvDownload = staff.waitForEvent('download');
  await staff.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
  await pendingButton(staff, 'Preparando arquivo…');
  assert.equal((await csvDownload).suggestedFilename(), 'candidatos-herbamed.csv');
  await staff.unroute(csvFile);
  console.log('Menu RH e exportação CSV: OK.');
  await staff.goto(`${base}/rh/vagas`);

  const publicPage = await browser.newPage();
  activePage = publicPage;
  publicPage.on('pageerror', (error) => errors.push(error.message));
  await publicPage.goto(`${base}/vagas`);
  const filter = (url) =>
    url.pathname === '/vagas' && url.searchParams.get('q') === `ficticio-${token}`;
  await publicPage.route(filter, async (route) => {
    await delay();
    await route.continue();
  });
  await publicPage.getByLabel('Busque uma vaga').fill(`ficticio-${token}`);
  await publicPage.getByRole('button', { name: 'Buscar vagas', exact: true }).click();
  await pendingButton(publicPage, 'Buscando…');
  await publicPage.waitForURL((url) => url.searchParams.get('q') === `ficticio-${token}`);
  await expect(publicPage.getByRole('button', { name: 'Buscar vagas', exact: true })).toBeEnabled();
  await publicPage.unroute(filter);

  const exit = await watchPosts(staff, '/rh/vagas');
  await staff
    .locator('.sidebar')
    .getByRole('button', { name: 'Sair da conta', exact: true })
    .click();
  await pendingButton(staff, 'Saindo…');
  await staff.waitForURL('**/entrar');
  assert.equal(exit.count(), 1);
  await exit.stop();
  assert.deepEqual(errors, []);
  console.log(
    'OK: carregamento de menus desktop/mobile, formulários sem duplicação e com retry, MFA, filtros, PDF/JSON e saída; movimento reduzido e permissões preservados.',
  );
} catch (error) {
  if (activePage)
    await activePage
      .screenshot({ path: 'artifacts/loading-feedback/failure.png', fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill();
  for (const user of users) {
    await database
      .query('delete from public.candidates where user_id=$1', [user.id])
      .catch(() => {});
    const removed = await admin.auth.admin.deleteUser(user.id);
    if (removed.error) console.error('Não foi possível remover uma fixture local do teste.');
  }
  await database.end();
}
