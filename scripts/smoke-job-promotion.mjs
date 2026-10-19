import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

process.loadEnvFile('.env.local');
for (const key of ['SUPABASE_URL', 'DATABASE_URL']) {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env[key]).hostname), 'Somente ambientes locais');
}
const base = process.env.PROMOTION_TEST_URL || 'http://localhost:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Servidor de teste local');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new Client({ connectionString: process.env.DATABASE_URL });
const suffix = randomBytes(7).toString('hex');
const password = `Fixture!${randomBytes(24).toString('base64url')}`;
const users = [], jobs = [];
let browser, server, page, roleId;

function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest(), offset = hash.at(-1) & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function fixture(kind) {
  const email = `post-${kind}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null); const id = created.data.user.id; users.push(id);
  if (kind === 'rh') {
    await db.query('insert into public.staff(user_id,display_name,password_login_enabled,mfa_enabled) values($1,$2,true,true)', [id, 'RH fictício de divulgação']);
    await db.query("insert into public.staff_roles(user_id,role_id) select $1,id from public.roles where name='Recrutador'", [id]);
  }
  return { id, email };
}
async function job() {
  const slug = `postagem-ficticia-${suffix}-${jobs.length}`;
  const result = await db.query("insert into public.jobs(slug,title,city,state,work_model,contract_type,description,requirements,benefits,responsibilities,status,published_at) values($1,'Analista fictício de sistemas','Cidade fictícia','SP','Presencial','CLT','Descrição fictícia para a divulgação da oportunidade.',$2,$3,$4,'published',now()) returning id,code,slug", [slug, 'Formação fictícia em tecnologia\nConhecimento fictício de sistemas e colaboração entre equipes\nExperiência fictícia com dados\nRequisito fictício adicional', 'Benefício fictício de alimentação\nBenefício fictício de transporte\nPrograma fictício de desenvolvimento\nBenefício fictício de capacitação\nBenefício fictício adicional', 'Desenvolver sistemas fictícios\nApoiar equipes fictícias\nDocumentar processos fictícios\nPlanejar atividades fictícias']);
  jobs.push(result.rows[0].id); return result.rows[0];
}
async function login(target, email) {
  await target.goto(`${base}/entrar`); await target.getByLabel('E-mail', { exact: false }).fill(email);
  await target.locator('input[name=password]').fill(password);
  await target.getByRole('button', { name: 'Entrar', exact: true }).click();
}
async function png(response, filename) {
  assert.equal(response.status(), 200); assert.equal(response.headers()['content-type'], 'image/png');
  assert.match(response.headers()['cache-control'], /private, no-store/);
  const bytes = await response.body(), meta = await sharp(bytes).metadata();
  assert.equal(meta.width, 1080); assert.equal(meta.height, 1350); assert.ok(bytes.length < 4 * 1024 * 1024);
  if (filename) await writeFile(`artifacts/job-promotion/${filename}.png`, bytes);
  // Check actual text presence across successive images, beyond PNG metadata.
  for (const [name, left, top, width, height] of [
    ['destaque', 90, 145, 650, 300], ['título', 105, 490, 870, 115],
    ['contrato', 88, 630, 300, 40], ['conteúdo', 110, 758, 500, 350], ['link', 100, 1190, 870, 80],
  ]) {
    const { data, info } = await sharp(bytes).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let ink = 0;
    for (let p = 0; p < data.length; p += info.channels) if (data[p] > 215 && data[p + 1] > 215 && data[p + 2] > 215) ink++;
    assert.ok(ink > (name === 'contrato' ? 20 : 100), `Texto presente na imagem: ${name} (${ink})`);
  }
  const band = await sharp(bytes).extract({ left: 88, top: 1125, width: 904, height: 50 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let collision = 0;
  for (let p = 0; p < band.data.length; p += band.info.channels) if (band.data[p] > 215 && band.data[p + 1] > 215 && band.data[p + 2] > 215) collision++;
  assert.equal(collision, 0, 'Os destaques não invadem a chamada para candidatura');
  return bytes;
}
try {
  await db.connect(); await mkdir('artifacts/job-promotion', { recursive: true });
  const staff = await fixture('rh'), candidate = await fixture('candidate');
  const opportunity = await job(), other = await job();
  const endpoint = `${base}/api/rh/vagas/${opportunity.id}/postagem`;
  if (!process.env.PROMOTION_TEST_URL) {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3001'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, APP_URL: base } });
  }
  for (let n = 0; n < 60; n++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error('Servidor temporário indisponível');
    try { if ((await fetch(`${base}/entrar`, { signal: AbortSignal.timeout(2000) })).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  assert.equal((await page.request.get(endpoint)).status(), 401, 'Visitante recusado');
  assert.equal((await page.request.post(endpoint, { data:{kind:'requirements',items:['Texto'],benefits:[]} })).status(), 401);
  assert.equal((await page.request.get(`${base}/api/rh/vagas/invalido/postagem`)).status(), 400);
  await login(page, staff.email); await page.waitForURL('**/seguranca');
  assert.equal((await page.request.get(endpoint)).status(), 403, 'MFA obrigatório preservado');
  assert.equal((await page.request.post(endpoint, { data:{kind:'requirements',items:['Texto'],benefits:[]} })).status(), 403);
  await page.getByRole('button', { name: 'Configurar autenticador' }).click();
  const secret = await page.locator('.card code').innerText();
  await page.getByLabel('Código de seis dígitos').fill(totp(secret));
  await page.getByRole('button', { name: 'Confirmar código', exact: true }).click(); await page.waitForURL('**/rh');
  const original = await png(await page.request.get(endpoint), 'poster');
  const savedJob = (await db.query('select title,requirements,responsibilities,benefits,updated_at from public.jobs where id=$1',[opportunity.id])).rows[0];
  await page.goto(`${base}/rh/vagas/${opportunity.id}`);
  const card = page.getByRole('region', { name: 'Divulgação da vaga' });
  const publicUrl = `${base}/vagas/${opportunity.slug}`;
  assert.equal(await card.getByLabel('Link público da vaga').inputValue(), publicUrl);
  await card.getByRole('button', { name: 'Copiar link', exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), publicUrl);
  await page.locator('input[name=title]').fill('Título ainda não salvo');
  let requests = 0;
  await page.route('**/api/rh/vagas/*/postagem', async route => { requests++; await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
  await card.getByRole('button', { name: 'Gerar postagem', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(requests,0,'Preparar não gera imagem antes da confirmação');
  assert.equal(await dialog.getByLabel('Conteúdo principal da postagem').inputValue(),'requirements');
  assert.equal(await dialog.getByLabel('Selecionar requisito 1',{exact:true}).isChecked(),true);
  assert.equal(await dialog.getByLabel('Selecionar requisito 4',{exact:true}).isDisabled(),true);
  await dialog.screenshot({path:'artifacts/job-promotion/editor-desktop.png'});
  const generatedResponse=page.waitForResponse(response=>response.url()===endpoint&&response.request().method()==='POST');
  await dialog.getByRole('button', { name: 'Gerar postagem', exact: true }).evaluate(button => { button.click(); button.click(); });
  await dialog.getByRole('button', { name: 'Gerando postagem…' }).waitFor();
  const generated=await generatedResponse;
  assert.equal(generated.status(),200,generated.ok()?'Imagem pronta':JSON.stringify(await generated.json()));
  await dialog.getByRole('button',{name:'Baixar imagem PNG'}).waitFor(); assert.equal(requests, 1, 'Clique repetido não duplica geração');
  await page.unroute('**/api/rh/vagas/*/postagem');
  assert.equal(await dialog.getByLabel('Link público da vaga').inputValue(), publicUrl);
  const downloaded = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Baixar imagem PNG' }).click();
  const download = await downloaded; assert.equal(download.suggestedFilename(), `vaga-${opportunity.code}-herbamed.png`);
  const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), original, 'Prévia e download usam os dados salvos');
  await dialog.screenshot({ path: 'artifacts/job-promotion/preview-desktop.png' });
  await dialog.getByRole('button',{name:'Editar textos',exact:true}).click();
  await dialog.getByLabel('Conteúdo principal da postagem').selectOption('responsibilities');
  await dialog.getByLabel('Texto: responsabilidade 1',{exact:true}).fill('Atividade fictícia extensa '.repeat(12));
  await dialog.getByRole('status').filter({hasText:'Texto muito longo:'}).waitFor();
  await dialog.getByRole('button',{name:'Remover responsabilidade 2 da postagem'}).click();
  await dialog.getByRole('button',{name:'Adicionar texto em responsabilidades'}).click();
  await dialog.getByLabel('Texto: responsabilidade 5',{exact:true}).fill('Novo destaque fictício exclusivo desta imagem');
  await dialog.getByRole('button',{name:'Remover responsabilidade 3 da postagem'}).click();
  await dialog.getByLabel('Selecionar responsabilidade 4',{exact:true}).check();
  await dialog.getByRole('button',{name:'Remover benefício 1 da postagem'}).click();
  await dialog.getByLabel('Texto: benefício 2',{exact:true}).fill('Benefício fictício editado somente na imagem');
  await page.setViewportSize({width:390,height:844});
  await dialog.screenshot({path:'artifacts/job-promotion/editor-mobile.png'});
  assert.ok(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Editor sem overflow mobile');
  const editedRequest=page.waitForRequest(request=>request.url()===endpoint&&request.method()==='POST');
  await dialog.getByRole('button',{name:'Gerar postagem',exact:true}).click();
  const body=(await editedRequest).postDataJSON();
  assert.equal(body.kind,'responsibilities');assert.equal(body.items.length,3);assert.ok(body.items.includes('Novo destaque fictício exclusivo desta imagem'));
  assert.equal(body.benefits.length,3);assert.ok(body.benefits.includes('Benefício fictício editado somente na imagem'));
  await dialog.getByRole('button',{name:'Baixar imagem PNG'}).waitFor();
  const customPng=await png(await page.request.post(endpoint,{data:body}),'poster-edited');
  assert.notDeepEqual(customPng,original,'Textos temporários afetam a imagem');
  assert.deepEqual((await db.query('select title,requirements,responsibilities,benefits,updated_at from public.jobs where id=$1',[opportunity.id])).rows[0],savedJob,'A preparação não altera o cadastro');
  await dialog.getByRole('button',{name:'Editar textos',exact:true}).click();
  assert.equal(await dialog.getByLabel('Texto: responsabilidade 5',{exact:true}).inputValue(),'Novo destaque fictício exclusivo desta imagem','Voltar preserva edições');
  await dialog.getByRole('button',{name:'Gerar postagem',exact:true}).click();await dialog.getByRole('button',{name:'Baixar imagem PNG'}).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.screenshot({ path: 'artifacts/job-promotion/preview-mobile.png' });
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Modal sem overflow');
  await dialog.getByRole('button', { name: 'Fechar janela' }).click();
  await card.screenshot({ path: 'artifacts/job-promotion/card-mobile.png' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Página sem overflow');
  // Recoverable generation failures and clipboard fallback.
  await page.route('**/api/rh/vagas/*/postagem', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Falha fictícia para conferir nova tentativa.' }) }));
  await card.getByRole('button', { name: 'Gerar postagem', exact: true }).click();
  await dialog.getByLabel('Texto: requisito 1',{exact:true}).fill('Texto fictício que precisa ser preservado na falha');
  await dialog.getByRole('button', { name: 'Gerar postagem', exact: true }).click(); await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Gerar postagem', exact: true }).isEnabled(), true);
  assert.equal(await dialog.getByLabel('Texto: requisito 1',{exact:true}).inputValue(),'Texto fictício que precisa ser preservado na falha');
  await page.unroute('**/api/rh/vagas/*/postagem');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Fixture'); } } }));
  await card.getByRole('button', { name: 'Copiar link', exact: true }).click();
  await card.getByRole('status').filter({ hasText: 'Selecione e copie' }).waitFor();
  assert.equal(await card.getByLabel('Link público da vaga').evaluate(input => input.selectionEnd - input.selectionStart), publicUrl.length);
  assert.equal((await page.request.post(endpoint,{data:{kind:'requirements',items:['Texto'],benefits:[],url:'https://other.example.test'}})).status(),422);
  assert.equal((await page.request.post(endpoint,{data:body,headers:{origin:'https://other.example.test'}})).status(),403);
  assert.equal((await page.request.post(endpoint,{data:'x'.repeat(256*1024+1),headers:{'content-type':'application/json'}})).status(),413);
  assert.equal((await page.request.post(endpoint,{data:{kind:'requirements',items:[' '],benefits:[]}})).status(),422);
  await png(await page.request.post(endpoint,{data:{kind:'responsibilities',items:['Atividade fictícia sem benefícios selecionados'],benefits:[]}}),'poster-no-benefits');
  for (const change of ["status='draft'", "status='paused'", "status='closed'", "visibility='internal'", "deadline=now()-interval '1 day'"]) {
    await db.query(`update public.jobs set ${change} where id=$1`, [opportunity.id]);
    assert.equal((await page.request.get(endpoint)).status(), 409, 'Vaga indisponível bloqueada');
    await db.query("update public.jobs set status='published',visibility='public',deadline=null where id=$1", [opportunity.id]);
  }
  await db.query("update public.jobs set status='draft' where id=$1", [opportunity.id]);
  await page.reload(); assert.equal(await card.getByRole('button', { name: 'Gerar postagem' }).count(), 0);
  await db.query("update public.jobs set status='published',title=$2,requirements=$3,benefits=$4 where id=$1", [opportunity.id, 'Analista fictício de operações e desenvolvimento de sistemas corporativos com atuação em projetos e melhoria dos processos internos e suporte às equipes de trabalho'.slice(0, 160), Array(6).fill('Requisito extenso fictício para conferir a disposição das informações e a leitura das principais responsabilidades.').join('\n'), Array(8).fill('Benefício fictício com condições adicionais disponíveis no portal.').join('\n')]);
  await png(await page.request.get(endpoint), 'poster-long');
  await db.query("update public.jobs set requirements='',responsibilities='',benefits='' where id=$1", [opportunity.id]);
  await png(await page.request.get(endpoint), 'poster-minimal');
  const portal = await browser.newPage(); await portal.goto(publicUrl);
  await portal.getByRole('button', { name: 'Copiar link', exact: true }).waitFor();
  await login(portal, candidate.email); await portal.waitForURL('**/candidato');
  assert.equal((await portal.request.get(endpoint)).status(), 403, 'Candidato recusado');
  assert.equal((await portal.request.post(endpoint,{data:body})).status(),403);
  // Read permission and the assigned-job scope remain authoritative on the API.
  roleId = (await db.query("insert into public.roles(name,scope) values($1,'assigned') returning id", [`Perfil fictício de postagem ${suffix}`])).rows[0].id;
  await db.query("insert into public.role_permissions(role_id,permission) values($1,'jobs.read')", [roleId]);
  await db.query('delete from public.staff_roles where user_id=$1', [staff.id]);
  await db.query('insert into public.staff_roles(user_id,role_id) values($1,$2)', [staff.id, roleId]);
  await db.query('insert into public.job_assignments(job_id,user_id) values($1,$2)', [opportunity.id, staff.id]);
  await png(await page.request.get(endpoint));
  await png(await page.request.post(endpoint,{data:body}));
  assert.equal((await page.request.get(`${base}/api/rh/vagas/${other.id}/postagem`)).status(), 403, 'Escopo de outra vaga recusado');
  assert.equal((await page.request.post(`${base}/api/rh/vagas/${other.id}/postagem`,{data:body})).status(),403);
  await db.query("insert into private.staff_permission_overrides(user_id,permission,allowed) values($1,'jobs.read',false)", [staff.id]);
  assert.equal((await page.request.get(endpoint)).status(), 403, 'Permissão revogada recusada');
  await db.query('update public.staff set active=false where user_id=$1', [staff.id]);
  assert.equal((await page.request.get(endpoint)).status(), 403, 'Conta desativada recusada');
  assert.deepEqual(errors, []);
  console.log('PASS: preparação, seleção/edição, avisos, PNG e prévia/download, vaga preservada, rascunho/retry, mobile, validação HTTP, publicação, MFA e escopo de acesso.');
} catch (error) {
  await page?.screenshot({ path: 'artifacts/job-promotion/failure.png', fullPage: true }); throw error;
} finally {
  await browser?.close(); server?.kill();
  for (const id of jobs) await db.query('delete from public.jobs where id=$1', [id]);
  for (const id of users) { await db.query('delete from public.staff_roles where user_id=$1', [id]); await db.query('delete from public.staff where user_id=$1', [id]); await admin.auth.admin.deleteUser(id); }
  if (roleId) { await db.query('delete from public.role_permissions where role_id=$1', [roleId]); await db.query('delete from public.roles where id=$1', [roleId]); }
  await db.end();
}
