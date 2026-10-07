import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { chromium } from '@playwright/test';

// Google itself is not mocked as a successful authentication. A local identity
// fixture verifies the mandatory onboarding; the OAuth start checks real PKCE.
process.loadEnvFile('.env.local');
for (const key of ['SUPABASE_URL','DATABASE_URL']) if (!['localhost','127.0.0.1'].includes(new URL(process.env[key]).hostname)) throw new Error('Este smoke usa somente o Supabase local.');
const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const database=new Client({connectionString:process.env.DATABASE_URL});
const base='http://localhost:3001';
const suffix=randomBytes(6).toString('hex');
const email=`google-${suffix}@example.test`;
const password=`Teste!${randomBytes(20).toString('base64url')}Aa1`;
let browser;let userId;let connected=false;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3001'],{stdio:'ignore',windowsHide:true,
 env:{...process.env,APP_ENV:'local',APP_URL:base,ENABLE_GOOGLE_LOGIN:'true',ENABLE_TURNSTILE:'false',VERCEL:'1'}});
try {
 await database.connect();connected=true;
 for(let i=0;i<60;i++) {
  if(server.exitCode!==null)throw new Error('Servidor temporário não iniciou.');
  try{if((await fetch(`${base}/api/health`)).ok)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const oauth=await browser.newPage({extraHTTPHeaders:{'x-vercel-forwarded-for':`2001:db8::${suffix.slice(0,4)}:${suffix.slice(4,8)}`}});
 await oauth.goto(`${base}/criar-conta`);
 await oauth.getByRole('button',{name:'Continuar com Google',exact:true}).waitFor();
 await oauth.goto(`${base}/entrar`);
 let authorize;
 await oauth.route(`${process.env.SUPABASE_URL}/auth/v1/authorize**`,async route=>{
  authorize=new URL(route.request().url());
  await route.fulfill({contentType:'text/html',body:'<p>Interrupção local antes do provedor externo.</p>'});
 });
 await oauth.getByRole('button',{name:'Continuar com Google',exact:true}).click();
 await oauth.waitForURL(url=>url.pathname==='/auth/v1/authorize');
 assert.equal(authorize.searchParams.get('provider'),'google');
 assert.equal(authorize.searchParams.get('code_challenge_method'),'s256');
 assert.ok(authorize.searchParams.get('code_challenge')?.length>=43,'PKCE presente');
 assert.equal(authorize.searchParams.get('redirect_to'),`${base}/auth/callback?provider=google`);
 assert.equal(authorize.searchParams.get('scopes'),'openid email profile');
 const verifier=(await oauth.context().cookies(base)).find(cookie=>cookie.name.includes('code-verifier'));
 assert.ok(verifier?.httpOnly && verifier.sameSite==='Lax','Verificador PKCE protegido por cookie HttpOnly');
 await oauth.close();

 const created=await service.auth.admin.createUser({email,password,email_confirm:true});
 assert.ok(!created.error && created.data.user,'Fixture fictícia local criada');userId=created.data.user.id;
 await database.query("insert into auth.identities(id,user_id,provider,provider_id,identity_data,created_at,updated_at,last_sign_in_at) values(gen_random_uuid(),$1::uuid,'google',$1::uuid::text,jsonb_build_object('sub',$1::uuid::text,'email',$2::text,'email_verified',true),now(),now(),now())",[userId,email]);
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(`${base}/entrar`);await page.getByLabel('E-mail',{exact:false}).fill(email);
 await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.waitForURL(`${base}/completar-cadastro`);
 await page.getByRole('heading',{name:'Complete seus dados'}).waitFor();
 assert.equal(await page.locator('main#conteudo').count(),1,'Sem landmarks duplicados');
 for(const path of ['/candidato','/candidato/perfil','/rh']) {
  await page.goto(`${base}${path}`);await page.waitForURL(`${base}/completar-cadastro`);
 }
 assert.equal((await page.request.get(`${base}/api/my-data`)).status(),403,'API bloqueada antes de identificar');
 await mkdir('artifacts/google-login',{recursive:true});
 await page.getByLabel('CPF').fill('52998224724');await page.getByLabel('Data de nascimento').fill('1995-06-15');
 await page.locator('form').first().evaluate(form=>{form.noValidate=true;});
 await page.getByRole('button',{name:'Concluir cadastro',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Informe um CPF válido'}).waitFor();
 assert.equal(await page.getByLabel('CPF').inputValue(),'52998224724','Campos preservados após erro');
 assert.equal((await database.query('select user_id from private.candidate_registration where user_id=$1',[userId])).rowCount,0);
 await page.getByLabel('CPF').fill('52998224725');await page.getByLabel('Data de nascimento').fill('2099-06-15');
 await page.locator('form').first().evaluate(form=>{form.noValidate=false;});
 await page.getByRole('button',{name:'Concluir cadastro',exact:true}).click();
 await page.getByText('Informe uma data válida, que não esteja no futuro.',{exact:true}).waitFor();
 assert.equal((await database.query('select user_id from private.candidate_registration where user_id=$1',[userId])).rowCount,0,'Data futura não conclui cadastro');
 await page.getByLabel('CPF').fill('529.982.247-25');await page.getByLabel('Data de nascimento').fill('1995-06-15');
 await page.screenshot({path:'artifacts/google-login/onboarding-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Cadastro responsivo');
 await page.screenshot({path:'artifacts/google-login/onboarding-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Concluir cadastro',exact:true}).click();await page.waitForURL(`${base}/candidato`);
 const stored=(await database.query('select cpf,birth_date::text from private.candidate_registration where user_id=$1',[userId])).rows[0];
 assert.deepEqual(stored,{cpf:'52998224725',birth_date:'1995-06-15'});
 assert.equal((await database.query('select user_id from public.staff where user_id=$1',[userId])).rowCount,0,'Sem perfil de equipe');
 const metadata=(await database.query('select raw_user_meta_data from auth.users where id=$1',[userId])).rows[0].raw_user_meta_data;
 assert.ok(!metadata.cpf && !metadata.birth_date,'Identificação privada fora do JWT');
 await page.goto(`${base}/completar-cadastro`);await page.waitForURL(`${base}/candidato`);
 await page.goto(`${base}/candidato/conta`);await page.getByText('CPF: ***.***.***-25',{exact:true}).waitFor();
 assert.equal((await page.request.get(`${base}/api/my-data`)).status(),200,'Área e exportação liberadas depois de identificar');
 await page.goto(`${base}/entrar`);await page.screenshot({path:'artifacts/google-login/login-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Login responsivo');
 console.log('PASS: início OAuth/PKCE, identificação obrigatória, CPF/data inválidos, bloqueio página/API, conclusão privada e desktop/mobile. Autenticação real Google requer configuração hospedada.');
} finally {
 try {
  await browser?.close();
  if(userId){const removed=await service.auth.admin.deleteUser(userId);assert.ok(!removed.error,'Limpeza da fixture falhou');}
 } finally {
  if(connected)await database.end();
  server.kill();if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));
 }
}
