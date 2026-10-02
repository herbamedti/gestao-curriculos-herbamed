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
async function chip(page, label, value) {
  const section=page.locator('.editable-list').filter({has:page.getByRole('heading',{name:label,exact:true})});
  await section.locator('input[data-list-draft]').fill(value);
  await section.getByRole('button',{name:'Adicionar',exact:true}).click();
}
async function staged(page, kind, label, title) {
  const section=page.getByRole('region',{name:label,exact:true});
  await section.locator('summary').click();
  await section.locator(`input[name="draft_${kind}_title"]`).fill(title);
  if(kind!=='language')await section.locator(`input[name="draft_${kind}_organization"]`).fill('Instituição fictícia');
  if(kind==='language')await section.getByLabel('Nível do idioma').selectOption('Intermediário');
  if(kind==='certification')await section.locator(`input[name="draft_${kind}_duration_hours"]`).fill('9');
  if(kind==='experience'){
    await section.locator(`input[name="draft_${kind}_start_date"]`).fill('2026-01-01');
    await section.locator(`input[name="draft_${kind}_end_date"]`).fill('2026-03-30');
    await section.locator(`select[name="draft_${kind}_status"]`).selectOption('Concluído');
  }
  const description=section.locator('.editable-list');
  await description.locator('input[data-list-draft]').fill(`Primeiro detalhe ${kind}; Segundo detalhe ${kind};`);
  await description.getByRole('button',{name:'Adicionar',exact:true}).click();
  await description.locator('input[data-list-draft]').fill(`Terceiro detalhe ${kind}`);
  await description.locator('input[data-list-draft]').press('Enter');
  assert.equal(await description.locator('.editable-items li').count(),3);
  assert.equal(await section.getByRole('button',{name:`Remover ${title}`,exact:true}).count(),0,'Enter adiciona apenas o detalhe, não a experiência inteira');
  await description.locator('.editable-items input').first().fill(`Detalhe revisado ${kind}`);
  await description.getByRole('button',{name:`Remover Segundo detalhe ${kind}`,exact:true}).click();
  await section.locator('.entry-draft > button').press('Enter');
  await section.getByRole('button',{name:`Remover ${title}`,exact:true}).waitFor();
  assert.equal(await section.locator('.entry-bullets li').count(),2);
  await section.locator('summary').click();
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
  await chip(page,'Habilidades','Excel');
  await page.getByLabel('Nova habilidade').fill('Comunicação'); await page.getByLabel('Nova habilidade').press('Enter');
  await page.getByRole('button', { name: 'Remover Excel', exact: true }).click();
  await chip(page,'Competências Pessoais','Trabalho em equipe');
  await chip(page,'Competências Pessoais','Proatividade');
  await page.getByRole('button',{name:'Remover Proatividade',exact:true}).click();
  for(const [kind,label,title] of [['experience','Experiência Profissional','Analista fictício'],['education','Histórico Acadêmico','Superior fictício'],['course','Cursos','Curso fictício'],['certification','Certificados','Certificado fictício'],['language','Idiomas','Português']])await staged(page,kind,label,title);
  // A filled draft cannot silently disappear on the final save.
  const pending=page.getByRole('region',{name:'Cursos',exact:true});
  await pending.locator('summary').click();
  await pending.locator('input[data-list-draft]').fill('Detalhe de um curso ainda não adicionado');
  await pending.locator('.editable-list').getByRole('button',{name:'Adicionar',exact:true}).click();
  await page.getByRole('button',{name:'Salvar dados do currículo',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Há uma informação de trajetória'}).waitFor();
  await pending.getByRole('button',{name:'Remover Detalhe de um curso ainda não adicionado',exact:true}).click();
  await pending.locator('summary').click();
  await page.screenshot({ path: 'artifacts/curriculum-fields/candidate-desktop.png', fullPage: true });
  await save(page, 'Salvar dados do currículo');
  await page.reload();
  assert.equal(await page.getByRole('button', { name: 'Remover Comunicação', exact: true }).count(), 1);
  assert.equal(await page.getByLabel('Habilitação (opcional)').inputValue(), 'AB');
  assert.equal(await page.getByRole('button',{name:'Remover Trabalho em equipe',exact:true}).count(),1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/curriculum-fields/candidate-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/candidato/perfil?etapa=trajetoria`);
  const languages=page.getByRole('region',{name:'Idiomas',exact:true});
  await languages.getByText('Adicionar idioma',{exact:true}).click();
  const languageForm=languages.locator('form').filter({has:page.locator('input[name="op"][value="entry"]')});
  await languageForm.locator('input[name="title"]').fill('Inglês');
  await languageForm.getByLabel('Nível do idioma').selectOption('Intermediário');
  await languageForm.locator('input[data-list-draft]').fill('Uso profissional do idioma; Leitura de documentação');
  await languageForm.locator('.editable-list').getByRole('button',{name:'Adicionar',exact:true}).click();
  await languageForm.getByRole('button',{name:'Adicionar ao currículo',exact:true}).click();
  await languageForm.getByRole('status').waitFor();
  assert.equal(await languageForm.locator('.editable-items li').count(),0,'Uma nova informação começa sem os detalhes da anterior');
  await page.reload(); await languages.getByText('Inglês', { exact: true }).waitFor();
  await page.screenshot({path:'artifacts/curriculum-fields/trajectory-cards.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.setViewportSize({width:1440,height:1000});
  const candidateId = (await database.query('select id from public.candidates where user_id=$1', [users[0].id])).rows[0].id;
  assert.equal((await database.query('select count(*)::integer as count from public.profile_entries where candidate_id=$1',[candidateId])).rows[0].count,6);
  const savedDescriptions=(await database.query('select kind,description from public.profile_entries where candidate_id=$1 and kind<>$2',[candidateId,'language'])).rows;
  for(const entry of savedDescriptions)assert.equal(entry.description,`Detalhe revisado ${entry.kind}\nTerceiro detalhe ${entry.kind}`);
  const experiences=page.getByRole('region',{name:'Experiência Profissional',exact:true});
  await experiences.getByText('01/01/2026 – 30/03/2026',{exact:true}).waitFor();
  await experiences.getByText('Editar informação',{exact:true}).click();
  const experienceEdit=experiences.locator('form').filter({has:page.locator('input[name="op"][value="edit-entry"]')});
  assert.equal(await experienceEdit.locator('.editable-items input').count(),2);
  await experienceEdit.locator('.editable-items input').first().fill('Atividade revisada pelo candidato');
  await experienceEdit.getByRole('button',{name:'Salvar alteração',exact:true}).click();
  await experiences.locator('.entry-bullets').getByText('Atividade revisada pelo candidato',{exact:true}).waitFor();
  const pdf = await page.request.get(`${base}/api/curriculos/${candidateId}/pdf`); assert.equal(pdf.status(), 200);
  await writeFile('artifacts/curriculum-fields/exported-example.pdf', await pdf.body());

  const staffPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage=staffPage;
  staffPage.on('pageerror',error=>errors.push(error.message));
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
  await chip(staffPage,'Habilidades','Atendimento');
  await chip(staffPage,'Competências Pessoais','Comunicação eficaz');
  for(const [kind,label,title] of [['experience','Experiência Profissional','Analista manual'],['education','Histórico Acadêmico','Superior manual'],['course','Cursos','Curso manual'],['certification','Certificados','Certificado manual'],['language','Idiomas','Inglês manual']])await staged(staffPage,kind,label,title);
  await staffPage.screenshot({path:'artifacts/curriculum-fields/manual-cards.png',fullPage:true});
  await staffPage.setViewportSize({width:390,height:844});
  assert.ok(await staffPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await staffPage.setViewportSize({width:1440,height:1000});
  await staffPage.getByRole('button', { name: 'Cadastrar currículo',exact:true }).click();
  await staffPage.waitForURL(/\/rh\/candidatos\/[0-9a-f-]+$/, { timeout: 30000 });
  assert.equal(await staffPage.getByLabel('Habilitação (opcional)').inputValue(), 'B');
  const manualId=staffPage.url().split('/').at(-1);
  assert.equal((await database.query('select count(*)::integer as count from public.profile_entries where candidate_id=$1',[manualId])).rows[0].count,5);
  const managerExperience=staffPage.getByRole('region',{name:'Experiência Profissional',exact:true});
  await managerExperience.getByText('Editar informação',{exact:true}).click();
  const managerEdit=managerExperience.locator('form').filter({has:staffPage.locator('input[name="op"][value="edit-entry"]')});
  const managerActivity='Atividade adicionada pelo gestor com colaboração em equipe e comunicação eficaz para desenvolver projetos de tecnologia, apoiar usuários e acompanhar resultados das soluções entregues.';
  await managerEdit.locator('input[data-list-draft]').fill(`${managerActivity}; Outro resultado do gestor`);
  await managerEdit.getByRole('button',{name:'Adicionar',exact:true}).click();
  await managerEdit.getByRole('button',{name:'Salvar alteração',exact:true}).click();
  await managerExperience.locator('.entry-bullets').getByText(managerActivity,{exact:true}).waitFor();
  assert.equal(await managerExperience.locator('.entry-bullets li').count(),4);
  await managerExperience.getByText('Editar informação',{exact:true}).click();
  await managerExperience.screenshot({path:'artifacts/curriculum-fields/experience-bullets.png'});
  const managerPdf=await staffPage.request.get(`${base}/api/curriculos/${manualId}/pdf`);assert.equal(managerPdf.status(),200);
  await writeFile('artifacts/curriculum-fields/manager-bullets.pdf',await managerPdf.body());
  assert.deepEqual((await database.query('select additional_info from public.candidates where id=$1',[manualId])).rows[0].additional_info.personal_competencies,['Comunicação eficaz']);
  const manualCertificate=staffPage.getByRole('region',{name:'Certificados',exact:true});
  await manualCertificate.getByText('Editar informação',{exact:true}).click();
  await manualCertificate.locator('form').filter({has:staffPage.locator('input[name="op"][value="edit-entry"]')}).locator('input[name="duration_hours"]').fill('12');
  await manualCertificate.getByRole('button',{name:'Salvar alteração',exact:true}).click();
  await manualCertificate.getByText(/12 horas/).waitFor();
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
  for (const [label, value] of [['Responsabilidades', 'Desenvolver os sistemas da empresa; Auxiliar usuários;'], ['Requisitos', 'Conhecimento em sistemas; Trabalho em equipe;'], ['Benefícios', 'Vale alimentação; Vale transporte;']]) {
    const section = staffPage.locator('.editable-list').filter({ has: staffPage.getByRole('heading', { name: label, exact: true }) });
    await section.getByLabel(`Adicionar item em ${label.toLowerCase()}`).fill(value); await section.getByRole('button', { name: 'Adicionar', exact: true }).click();
    assert.equal(await section.locator('.editable-items li').count(),2);
    // Measure both elements in the same frame, even during smooth scrolling.
    const gap=await section.evaluate(element=>element.querySelector('.list-help').getBoundingClientRect().top-element.querySelector('.list-input-row').getBoundingClientRect().bottom);
    assert.ok(gap>=10,'Ajuda não sobrepõe o campo');
    if(label==='Responsabilidades')await section.screenshot({path:'artifacts/curriculum-fields/responsibilities.png'});
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
  console.log('OK: cards iniciais completos do gestor/candidato, competências, edição, validação de rascunho, PDF, listas por ponto e vírgula e espaçamento desktop/mobile.');
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
