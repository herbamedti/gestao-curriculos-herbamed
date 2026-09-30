import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const local = await readFile('.env.test.local', 'utf8');
const password = process.env.TEST_DEMO_PASSWORD || local.match(/^TEST_DEMO_PASSWORD=(.+)$/m)?.[1];
if (!password) throw new Error('Senha fictícia ausente de .env.test.local');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/entrar');
  await page.getByLabel('E-mail').fill('rh.demo@herbamed.test');
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/entrar', { timeout: 15000 });
  await page.goto('http://localhost:3000/rh/conta');
  await page.getByRole('heading', { name: 'Conta', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Conta' }).waitFor();
  // A prior interrupted smoke run may have left this local-only seed opted out.
  if (await page.getByRole('button', { name: 'Ativar exigência' }).count()) {
    await page.getByRole('button', { name: 'Ativar exigência' }).click();
    await page.getByText('Autenticação em duas etapas ativada').waitFor();
    await page.reload();
  }
  const previous = await fetch('http://127.0.0.1:54324/api/v1/messages').then(r => r.json());
  const previousIds = new Set(previous.messages.map(item => item.ID));
  await page.getByRole('button', { name: 'Enviar código por e-mail' }).click();
  await page.getByText('Enviamos um código').waitFor();

  const listing = await fetch('http://127.0.0.1:54324/api/v1/messages').then(r => r.json());
  const message = listing.messages.find(item => !previousIds.has(item.ID) && item.Subject === 'Código de confirmação da conta Herbamed');
  assert.ok(message, 'E-mail de confirmação não recebido no Mailpit');
  const detail = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`).then(r => r.json());
  const code = detail.Text.match(/\b[A-F0-9]{10}\b/)?.[0];
  assert.ok(code, 'Código de confirmação ausente');

  page.on('dialog', dialog => dialog.accept());
  const disable = page.locator('form').filter({ has: page.getByRole('button', { name: 'Desativar exigência' }) });
  await disable.locator('select[name="method"]').selectOption('email');
  await disable.locator('input[name="code"]').fill(code);
  await disable.getByRole('button', { name: 'Desativar exigência' }).click();
  await page.getByText('Exigência de duas etapas desativada').waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Ativar exigência' }).click();
  await page.getByText('Autenticação em duas etapas ativada').waitFor();

  await page.goto('http://localhost:3000/entrar');
  await page.getByLabel('E-mail').fill('candidata.demo@example.test');
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/entrar', { timeout: 15000 });
  await page.goto('http://localhost:3000/candidato/conta');
  await page.getByRole('heading', { name: 'Conta', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Conta' }).waitFor();
  const emailForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Solicitar alteração do e-mail' }) });
  await emailForm.locator('input[name="email"]').fill('invalid.change@example.test');
  await emailForm.locator('input[name="code"]').fill('0000000000');
  await emailForm.getByRole('button', { name: 'Solicitar alteração do e-mail' }).click();
  await page.getByText('Código de e-mail inválido').waitFor();
  const passwordForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Alterar senha' }) });
  await passwordForm.locator('input[name="password"]').fill('TesteConta!123456');
  await passwordForm.locator('input[name="confirm_password"]').fill('TesteConta!123456');
  await passwordForm.locator('input[name="code"]').fill('0000000000');
  await passwordForm.getByRole('button', { name: 'Alterar senha' }).click();
  await page.getByText('Código de e-mail inválido').last().waitFor();

  const config = await readFile('.env.local', 'utf8');
  const envValue = key => config.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1];
  const service = createClient(envValue('SUPABASE_URL'), envValue('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const suffix = randomBytes(5).toString('hex');
  const temporaryEmail = `account-${suffix}@example.test`;
  const initialPassword = `Conta!${randomBytes(15).toString('base64url')}`;
  const changedPassword = `Nova!${randomBytes(15).toString('base64url')}`;
  const { data: created, error: createError } = await service.auth.admin.createUser({ email: temporaryEmail, password: initialPassword, email_confirm: true });
  if (createError || !created.user) throw createError || new Error('Conta de teste não criada');
  let secondUserId;
  try {
    const temp = await browser.newPage();
    await temp.goto('http://localhost:3000/entrar');
    await temp.getByLabel('E-mail').fill(temporaryEmail);
    await temp.getByLabel('Senha').fill(initialPassword);
    await temp.getByRole('button', { name: 'Entrar', exact: true }).click();
    await temp.waitForURL('**/candidato', { timeout: 15000 });
    await temp.goto('http://localhost:3000/candidato/conta');
    await temp.getByRole('heading', { name: 'Conta', exact: true }).waitFor();

    async function requestCode(target) {
      const before = await fetch('http://127.0.0.1:54324/api/v1/messages').then(r => r.json());
      const ids = new Set(before.messages.map(item => item.ID));
      await target.getByRole('button', { name: 'Enviar código por e-mail' }).click();
      await target.getByText('Enviamos um código').waitFor();
      const after = await fetch('http://127.0.0.1:54324/api/v1/messages').then(r => r.json());
      const sent = after.messages.find(item => !ids.has(item.ID) && item.Subject === 'Código de confirmação da conta Herbamed');
      assert.ok(sent, 'Código da conta temporária não chegou ao Mailpit');
      const body = await fetch(`http://127.0.0.1:54324/api/v1/message/${sent.ID}`).then(r => r.json());
      const value = body.Text.match(/\b[A-F0-9]{10}\b/)?.[0];
      assert.ok(value, 'Código da conta temporária ausente');
      return value;
    }
    const passwordCode = await requestCode(temp);
    const changePassword = temp.locator('form').filter({ has: temp.getByRole('button', { name: 'Alterar senha' }) });
    await changePassword.locator('input[name="password"]').fill(changedPassword);
    await changePassword.locator('input[name="confirm_password"]').fill(changedPassword);
    await changePassword.locator('input[name="code"]').fill(passwordCode);
    await changePassword.getByRole('button', { name: 'Alterar senha' }).click();
    await temp.waitForURL('**/entrar', { timeout: 15000 });
    await temp.getByLabel('E-mail').fill(temporaryEmail);
    await temp.getByLabel('Senha').fill(changedPassword);
    await temp.getByRole('button', { name: 'Entrar', exact: true }).click();
    await temp.waitForURL('**/candidato', { timeout: 15000 });

    const emailLogin = `account-email-${suffix}@example.test`;
    const { data: second, error: secondError } = await service.auth.admin.createUser({ email: emailLogin, password: initialPassword, email_confirm: true });
    if (secondError || !second.user) throw secondError || new Error('Segunda conta de teste não criada');
    secondUserId = second.user.id;
    const tempEmail = await browser.newPage();
    await tempEmail.goto('http://localhost:3000/entrar');
    await tempEmail.getByLabel('E-mail').fill(emailLogin);
    await tempEmail.getByLabel('Senha').fill(initialPassword);
    await tempEmail.getByRole('button', { name: 'Entrar', exact: true }).click();
    await tempEmail.waitForURL('**/candidato', { timeout: 15000 });
    await tempEmail.goto('http://localhost:3000/candidato/conta');
    const emailCode = await requestCode(tempEmail);
    const changeEmail = tempEmail.locator('form').filter({ has: tempEmail.getByRole('button', { name: 'Solicitar alteração do e-mail' }) });
    await changeEmail.locator('input[name="email"]').fill(`account-new-${suffix}@example.test`);
    await changeEmail.locator('input[name="code"]').fill(emailCode);
    await changeEmail.getByRole('button', { name: 'Solicitar alteração do e-mail' }).click();
    await tempEmail.getByText('Solicitação enviada. Confirme os links').waitFor();
  } finally {
    if (secondUserId) await service.auth.admin.deleteUser(secondUserId);
    await service.auth.admin.deleteUser(created.user.id);
  }
  console.log('Conta RH e candidato, código por e-mail, MFA, senha e solicitação de e-mail: OK.');
} finally {
  await browser.close();
}
