import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { chromium } from '@playwright/test';

process.loadEnvFile('.env.local');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.SUPABASE_URL).hostname)) throw new Error('Este teste usa somente Supabase local.');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Banco do teste deve ser local.');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const database = new Client({ connectionString: process.env.DATABASE_URL });
const base = 'http://127.0.0.1:3001';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'], { env: { ...process.env, APP_URL: base }, stdio: 'ignore', windowsHide: true });
const token = randomBytes(5).toString('hex');
const password = `Test!${randomBytes(18).toString('base64url')}`;
const users = [];
let browser;
let activePage;
let staffId;
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase()].map(character => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest(); const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function login(page, email) {
  await page.goto(`${base}/entrar`); await page.getByLabel('E-mail').fill(email); await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/entrar'), { timeout: 30000 });
}
async function save(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Alterações salvas' }).waitFor({ timeout: 30000 });
}
try {
  await database.connect();
  await mkdir('artifacts/curriculum-fields', { recursive: true });
  for (const kind of ['candidate', 'staff']) {
    const email = `${kind}.${token}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(created.error, null); users.push({ id: created.data.user.id, email });
  }
  staffId = users[1].id;
  // Reviewed local fixtures only; normal application writes use authorized RPCs.
  await database.query('insert into public.staff(user_id,display_name,password_login_enabled) values($1,$2,true)', [staffId, 'Gestor Fictício']);
  await database.query("insert into public.staff_roles(user_id,role_id) select $1,id from public.roles where name='Superadministrador'", [staffId]);
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/entrar`)).ok) break; } catch { /* Starting. */ }
    if (server.exitCode !== null || attempt === 59) throw new Error('Servidor do teste não iniciou.');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage=page;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, users[0].email);
  await page.goto(`${base}/candidato/perfil`);
  await page.getByLabel('Nome completo').fill('Candidato Fictício');
  await page.getByLabel('Telefone com DDD').fill('(11) 99999-9999');
  await page.locator('input[name="city"]').fill('Cidade Exemplo');
  await page.getByLabel('Cargo ou área de atuação').fill('Analista de sistemas');
  await page.getByLabel(/Resumo profissional/).fill('Profissional fictício com experiência em desenvolvimento de sistemas e suporte aos usuários.');
  await page.getByLabel('Telefone alternativo (opcional)').fill('(11) 98888-8888');
  await page.getByLabel('Habilitação (opcional)').selectOption('AB');
  await page.getByLabel('Disponibilidade para viagens').check();
  await page.getByLabel('GitHub, portfólio ou site profissional (HTTPS, opcional)').fill('https://example.test/portfolio');
  await page.getByLabel('Nova habilidade').fill('Excel'); await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByLabel('Nova habilidade').fill('Comunicação'); await page.getByLabel('Nova habilidade').press('Enter');
  await page.getByRole('button', { name: 'Remover Excel', exact: true }).click();
  await page.screenshot({ path: 'artifacts/curriculum-fields/candidate-desktop.png', fullPage: true });
  await save(page, 'Salvar dados do currículo');
  await page.reload();
  assert.equal(await page.getByRole('button', { name: 'Remover Comunicação', exact: true }).count(), 1);
  assert.equal(await page.getByLabel('Habilitação (opcional)').inputValue(), 'AB');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/curriculum-fields/candidate-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/candidato/perfil?etapa=trajetoria`);
  await page.locator('select[name="kind"]').selectOption('language');
  await page.locator('input[name="title"]').fill('Inglês');
  await page.getByLabel('Nível do idioma').selectOption('Intermediário');
  await save(page, 'Adicionar ao currículo');
  await page.reload(); await page.getByText('Idioma: Inglês', { exact: true }).waitFor();
  const candidateId = (await database.query('select id from public.candidates where user_id=$1', [users[0].id])).rows[0].id;
  const pdf = await page.request.get(`${base}/api/curriculos/${candidateId}/pdf`); assert.equal(pdf.status(), 200);
  await writeFile('artifacts/curriculum-fields/exported-example.pdf', await pdf.body());

  const staffPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage=staffPage;
  await login(staffPage, users[1].email);
  await staffPage.getByRole('button', { name: 'Configurar autenticador', exact: true }).click();
  const secret = await staffPage.locator('code').innerText();
  await staffPage.getByLabel('Código de seis dígitos').fill(totp(secret));
  await staffPage.getByRole('button', { name: 'Confirmar código', exact: true }).click();
  await staffPage.waitForURL('**/rh', { timeout: 30000 });
  await staffPage.goto(`${base}/rh/candidatos/novo`);
  await staffPage.getByLabel('Nome completo').fill('Currículo Fictício Manual');
  await staffPage.locator('input[name="email"]').fill(`manual.${token}@example.test`);
  await staffPage.getByLabel('Origem (indicação, evento, cadastro manual…)').fill('Teste local');
  await staffPage.getByLabel('Base legal avaliada pela Herbamed').fill('Base fictícia para teste');
  await staffPage.getByLabel('Habilitação (opcional)').selectOption('B');
  await staffPage.getByLabel('Nova habilidade').fill('Atendimento'); await staffPage.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await staffPage.getByRole('button', { name: 'Cadastrar e continuar para experiência e formação' }).click();
  await staffPage.waitForURL(/\/rh\/candidatos\/[0-9a-f-]+$/, { timeout: 30000 });
  assert.equal(await staffPage.getByLabel('Habilitação (opcional)').inputValue(), 'B');
  await staffPage.goto(`${base}/rh/configuracoes`);
  const catalog = staffPage.locator('.card').filter({ has: staffPage.getByRole('heading', { name: 'Níveis de experiência', exact: true }) });
  await catalog.getByLabel('Novo cadastro').fill(`Nível ${token}`); await catalog.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await catalog.getByText(`Nível ${token}`, { exact: true }).waitFor();
  const item = catalog.locator('.catalog-item').filter({ hasText: `Nível ${token}` });
  await item.getByText('Editar cadastro', { exact: true }).click();
  await item.locator('input[name="name"]').fill(`Nível editado ${token}`); await item.getByRole('button', { name: 'Salvar cadastro' }).click();
  await catalog.getByText(`Nível editado ${token}`, { exact: true }).waitFor();
  await staffPage.screenshot({ path: 'artifacts/curriculum-fields/settings.png', fullPage: true });
  await staffPage.goto(`${base}/rh/vagas/nova`);
  await staffPage.getByLabel('Título da vaga').fill(`Vaga fictícia ${token}`);
  await staffPage.locator('input[name="city"]').fill('Cidade Exemplo');
  await staffPage.locator('textarea[name="description"]').fill('Oportunidade fictícia para validar listas e seletores de vagas.');
  const levelId = (await database.query('select id from public.experience_levels where name=$1', [`Nível editado ${token}`])).rows[0].id;
  await staffPage.getByLabel('Nível de experiência').selectOption(levelId);
  await staffPage.getByLabel('Tipo de emprego').selectOption({ label: 'Tempo integral' });
  for (const [label, value] of [['Responsabilidades', 'Desenvolver os sistemas da empresa;'], ['Responsabilidades', 'Auxiliar usuários;'], ['Requisitos', 'Conhecimento em sistemas;'], ['Benefícios', 'Vale alimentação;']]) {
    const section = staffPage.locator('.editable-list').filter({ has: staffPage.getByRole('heading', { name: label, exact: true }) });
    await section.getByLabel(`Adicionar item em ${label.toLowerCase()}`).fill(value); await section.getByRole('button', { name: 'Adicionar', exact: true }).click();
  }
  await staffPage.screenshot({ path: 'artifacts/curriculum-fields/job-editor.png', fullPage: true });
  await staffPage.getByRole('button', { name: 'Salvar vaga', exact: true }).click(); await staffPage.waitForURL(/\/rh\/vagas\/[0-9a-f-]+$/, { timeout: 30000 });
  const job = (await database.query('select id,slug from public.jobs where created_by=$1 and title=$2', [staffId, `Vaga fictícia ${token}`])).rows[0];
  await staffPage.locator('select[name="status"]').selectOption('published'); await save(staffPage, 'Atualizar status');
  await staffPage.goto(`${base}/vagas/${job.slug}`);
  assert.equal(await staffPage.locator('.job-bullets').first().locator('li').count(), 2);
  await staffPage.getByText(`Nível editado ${token}`, { exact: true }).waitFor();
  await staffPage.screenshot({ path: 'artifacts/curriculum-fields/job-public.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('OK: gestor com MFA, candidato, habilidades, idiomas, PDF, configuração editável e vaga publicada em listas.');
} catch(error) {
  await activePage?.screenshot({path:'artifacts/curriculum-fields/failure.png',fullPage:true});
  throw error;
} finally {
  await browser?.close(); server.kill();
  if (staffId) {
    await database.query('delete from public.jobs where created_by=$1', [staffId]);
    await database.query('delete from public.candidates where created_by=$1 or user_id=$2', [staffId, users[0]?.id]);
    await database.query('delete from public.experience_levels where name in ($1,$2)', [`Nível ${token}`, `Nível editado ${token}`]);
  }
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
  await database.end();
}
