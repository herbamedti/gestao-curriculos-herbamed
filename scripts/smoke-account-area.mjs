import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { chromium } from '@playwright/test';

process.loadEnvFile('.env.local');
for (const key of ['SUPABASE_URL','DATABASE_URL']) {
 if (!['localhost','127.0.0.1'].includes(new URL(process.env[key]).hostname)) throw Error('Este teste usa somente banco e Auth locais.');
}
const base='http://localhost:3001';
const suffix=randomBytes(7).toString('hex');
const password=`Fixture!${randomBytes(24).toString('base64url')}`;
const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const database=new Client({connectionString:process.env.DATABASE_URL});
const users=[];let browser;let connected=false;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3001'],{
 windowsHide:true,stdio:'ignore',env:{...process.env,APP_ENV:'local',APP_URL:base,ENABLE_EMAIL:'false',ENABLE_TURNSTILE:'false'}});
function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
 const bits=[...secret].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join('');
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hash=createHmac('sha1',key).update(counter).digest();const offset=hash.at(-1)&15;
 return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
async function fixture(kind){
 const email=`area-${kind}-${suffix}@example.test`;
 const created=await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`Pessoa fictícia ${kind}`}});
 assert.ok(!created.error&&created.data.user,'Fixture local criada');
 const id=created.data.user.id;users.push(id);
 if(kind!=='candidate'){
  await database.query('insert into public.staff(user_id,display_name,password_login_enabled,mfa_enabled) values($1,$2,true,$3)',[id,`RH fictício ${kind}`,kind==='admin']);
  if(kind==='admin')await database.query("insert into public.staff_roles select $1,id from public.roles where name='Superadministrador'",[id]);
 }
 return {id,email};
}
async function login(page,email){
 await page.goto(`${base}/entrar`);
 await page.getByLabel('E-mail',{exact:false}).fill(email);
 await page.locator('input[name=password]').fill(password);
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
}
async function myArea(page,destination){
 await page.goto(base);
 await page.getByRole('link',{name:'Minha área',exact:true}).click();
 await page.waitForURL(`${base}${destination}`);
}
try{
 await database.connect();connected=true;
 const admin=await fixture('admin'),candidate=await fixture('candidate'),limited=await fixture('limited');
 for(let n=0;n<60;n++){
  if(server.exitCode!==null)throw Error('Servidor temporário indisponível');
  try{if((await fetch(`${base}/entrar`,{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const guest=await browser.newPage();
 await myArea(guest,'/entrar');
 await guest.goto(`${base}/minha-area?perfil=rh&next=https://example.test`);
 await guest.waitForURL(`${base}/entrar`);
 await guest.goto(`${base}/candidato/conta`);await guest.waitForURL(`${base}/entrar`);

 const manager=await browser.newPage({viewport:{width:1440,height:1000}});
 await login(manager,admin.email);await manager.waitForURL(`${base}/seguranca`);
 await myArea(manager,'/seguranca');
 for(const path of ['/candidato','/candidato/conta','/rh/conta']){
  await manager.goto(`${base}${path}`);await manager.waitForURL(`${base}/seguranca`);
  assert.equal(await manager.locator('.user-info').getByText('Área do candidato',{exact:true}).count(),0);
 }
 await manager.getByRole('button',{name:'Configurar autenticador',exact:true}).click();
 const secret=await manager.locator('code').innerText();
 await manager.getByLabel('Código de seis dígitos').fill(totp(secret));
 await manager.getByRole('button',{name:'Confirmar código',exact:true}).click();
 await manager.waitForURL(`${base}/rh`);
 await myArea(manager,'/rh');
 await manager.locator('.user-info').getByText('Equipe Herbamed',{exact:true}).waitFor();
 for(const path of ['/candidato','/candidato/perfil','/candidato/conta','/candidato/candidaturas','/candidato/mensagens','/candidato/privacidade']){
  await manager.goto(`${base}${path}`);await manager.waitForURL(`${base}/rh`);
 }
 await manager.goto(`${base}/entrar?perfil=candidato&next=https://example.test`);await manager.waitForURL(`${base}/rh`);
 assert.equal((await database.query('select id from public.candidates where user_id=$1',[admin.id])).rowCount,0,'Navegação do gestor não cria candidato');
 await mkdir('artifacts/account-area',{recursive:true});
 await manager.screenshot({path:'artifacts/account-area/admin-desktop.png',fullPage:true});
 await manager.setViewportSize({width:390,height:844});await myArea(manager,'/rh');
 assert.ok(await manager.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Gestão responsiva');

 const portal=await browser.newPage();
 await login(portal,candidate.email);await portal.waitForURL(`${base}/candidato`);
 await myArea(portal,'/candidato');
 await portal.goto(`${base}/entrar?perfil=rh`);await portal.waitForURL(`${base}/candidato`);
 await portal.goto(`${base}/candidato/conta`);await portal.getByRole('heading',{name:'Conta',exact:true}).waitFor();
 await portal.locator('.user-info').getByText('Área do candidato',{exact:true}).waitFor();
 await portal.goto(`${base}/rh`);await portal.waitForURL(`${base}/acesso-negado`);

 const restricted=await browser.newPage();
 await login(restricted,limited.email);await restricted.waitForURL(`${base}/rh/conta`);
 await myArea(restricted,'/rh/conta');
 await restricted.goto(`${base}/candidato/conta`);await restricted.waitForURL(`${base}/rh/conta`);
 await database.query('update public.staff set active=false where user_id=$1',[limited.id]);
 await restricted.goto(`${base}/minha-area`);await restricted.waitForURL(`${base}/conta-indisponivel`);
 console.log('PASS: Minha área para visitante/candidato/RH, login já autenticado, MFA, rotas diretas, fallback sem dashboard, conta desativada e ausência de currículo administrativo.');
}finally{
 await browser?.close();
 if(connected){for(const id of users){const removed=await service.auth.admin.deleteUser(id);assert.ok(!removed.error,'Limpeza de fixture local');}await database.end();}
 server.kill();if(server.exitCode===null&&server.signalCode===null)await new Promise(r=>server.once('exit',r));
}
