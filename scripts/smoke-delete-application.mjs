import { spawn } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { chromium } from '@playwright/test';

process.loadEnvFile('.env.local');
for(const key of ['SUPABASE_URL','DATABASE_URL'])if(!['localhost','127.0.0.1'].includes(new URL(process.env[key]).hostname))throw Error('Somente banco e Auth locais.');
const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const database=new Client({connectionString:process.env.DATABASE_URL});
const base='http://localhost:3001',suffix=randomBytes(6).toString('hex');
const password=`Fixture!${randomBytes(24).toString('base64url')}`;
const users=[],jobs=[],applications=[];let browser,initialPrimary,candidateId,connected=false;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3001'],{windowsHide:true,stdio:'ignore',
 env:{...process.env,APP_ENV:'demo',APP_URL:base,ENABLE_EMAIL:'false',ENABLE_TURNSTILE:'false'}});
function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',bits=[...secret].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join('');
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hash=createHmac('sha1',key).update(counter).digest(),offset=hash.at(-1)&15;
 return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
async function account(kind){
 const email=`delete-${kind}-${suffix}@example.test`;
 const result=await service.auth.admin.createUser({email,password,email_confirm:true});assert.ok(!result.error&&result.data.user,'Fixture local criada');
 const id=result.data.user.id;users.push(id);
 if(kind!=='candidate'){
  await database.query('insert into public.staff(user_id,display_name,password_login_enabled,mfa_enabled) values($1,$2,true,$3)',[id,`RH fictício ${kind}`,kind==='primary']);
  await database.query("insert into public.staff_roles select $1,id from public.roles where name='Superadministrador'",[id]);
 }
 return {id,email};
}
async function login(page,email){
 await page.goto(`${base}/entrar`);await page.getByLabel('E-mail',{exact:false}).fill(email);
 await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
}
try{
 await database.connect();connected=true;initialPrimary=(await database.query('select user_id from private.primary_administrator')).rows[0]?.user_id;
 const primary=await account('primary'),delegated=await account('delegated'),candidate=await account('candidate');
 await database.query('update private.primary_administrator set user_id=$1',[primary.id]);
 candidateId=(await database.query("insert into public.candidates(user_id,full_name,email,city) values($1,'Pessoa fictícia para exclusão',$2,'Cidade fictícia') returning id",[candidate.id,candidate.email])).rows[0].id;
 await database.query("insert into public.profile_entries(candidate_id,kind,title,organization) values($1,'education','Curso fictício','Instituição fictícia')",[candidateId]);
 for(const name of ['A','B']){
  const job=(await database.query("insert into public.jobs(title,slug,city,work_model,description,status,published_at) values($1,$2,'Cidade fictícia','Remoto','Descrição fictícia para verificar exclusão administrativa de candidatura.','published',now()) returning id",[`Vaga de exclusão ${name} ${suffix}`,`delete-${name.toLowerCase()}-${suffix}`])).rows[0].id;jobs.push(job);
  const stage=(await database.query("insert into public.job_stages(job_id,name,position) values($1,'Inscrição',0) returning id",[job])).rows[0].id;
  const application=(await database.query('insert into public.applications(candidate_id,job_id,stage_id) values($1,$2,$3) returning id',[candidateId,job,stage])).rows[0].id;applications.push(application);
 }
 const question=(await database.query("insert into public.job_questions(job_id,label,position) values($1,'Pergunta fictícia',0) returning id",[jobs[0]])).rows[0].id;
 await database.query("insert into public.application_answers(application_id,question_id,answer) values($1,$2,'Resposta fictícia')",[applications[0],question]);
 await database.query("insert into public.application_events(application_id,note) values($1,'Histórico fictício')",[applications[0]]);
 await database.query("insert into public.evaluations(application_id,author_id,kind,body) values($1,$2,'note','Avaliação fictícia')",[applications[0],primary.id]);
 await database.query("insert into public.interviews(application_id,interviewer_id,starts_at,location) values($1,$2,now()+interval '1 day','Local fictício')",[applications[0],primary.id]);
 await database.query("update public.interviews set status='cancelled' where application_id=$1",[applications[0]]);
 await database.query("update public.applications set status='closed',unlinked_at=now() where id=$1",[applications[0]]);
 for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error('Servidor temporário indisponível');try{if((await fetch(`${base}/entrar`,{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const guest=await browser.newPage();
 for(const path of ['/','/entrar']){await guest.goto(`${base}${path}`);assert.equal(await guest.locator('.environment').count(),0,'Sem faixa de ambiente mesmo com APP_ENV=demo');}
 const other=await browser.newPage();await login(other,delegated.email);await other.waitForURL(`${base}/rh`);
 await other.goto(`${base}/rh/candidaturas`);assert.equal(await other.getByRole('button',{name:/Excluir candidatura de/}).count(),0,'Delegado não recebe botão');
 await other.goto(`${base}/rh/candidaturas/${applications[0]}`);await other.getByRole('heading',{name:'Pessoa fictícia para exclusão',exact:true}).waitFor();
 assert.equal(await other.getByRole('button',{name:/Excluir candidatura de/}).count(),0,'Detalhe também oculta exclusão do delegado');
 const delegatedClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 await delegatedClient.auth.signInWithPassword({email:delegated.email,password});
 const version=(await database.query('select updated_at from public.applications where id=$1',[applications[0]])).rows[0].updated_at.toISOString();
 assert.equal((await delegatedClient.rpc('delete_application',{p_application_id:applications[0],p_expected_updated_at:version})).error?.code,'42501','Chamada direta do delegado bloqueada');
 await delegatedClient.auth.signOut({scope:'local'});

 const page=await browser.newPage({viewport:{width:1440,height:1000}});await login(page,primary.email);await page.waitForURL(`${base}/seguranca`);
 await page.getByRole('button',{name:'Configurar autenticador',exact:true}).click();
 const secret=await page.locator('code').innerText();await page.getByLabel('Código de seis dígitos').fill(totp(secret));
 await page.getByRole('button',{name:'Confirmar código',exact:true}).click();await page.waitForURL(`${base}/rh`);
 await page.goto(`${base}/rh/candidaturas/${applications[0]}`);await page.getByRole('button',{name:'Excluir candidatura de Pessoa fictícia para exclusão',exact:true}).waitFor();
 await page.goto(`${base}/rh/vagas/${jobs[0]}/candidatos?status=all`);await page.getByRole('button',{name:'Excluir candidatura de Pessoa fictícia para exclusão',exact:true}).waitFor();
 await page.goto(`${base}/rh/candidaturas`);
 const row=()=>page.getByRole('row').filter({hasText:`Vaga de exclusão A ${suffix}`});
 const open=async()=>{await row().getByRole('button',{name:/Excluir candidatura de/}).click();return page.getByRole('dialog');};
 let modal=await open();assert.ok(await modal.getByRole('button',{name:'Excluir definitivamente',exact:true}).isDisabled());
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();await modal.waitFor({state:'hidden'});
 assert.equal((await database.query('select id from public.applications where id=$1',[applications[0]])).rowCount,1,'Cancelar preserva candidatura');
 modal=await open();await modal.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
 await database.query('update public.applications set updated_at=now() where id=$1',[applications[0]]);
 await modal.getByRole('button',{name:'Excluir definitivamente',exact:true}).click();await modal.getByRole('alert').filter({hasText:'Esta candidatura foi alterada'}).waitFor();
 assert.equal((await database.query('select id from public.applications where id=$1',[applications[0]])).rowCount,1,'Versão antiga não exclui');
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();await page.reload();
 await page.setViewportSize({width:390,height:844});modal=await open();
 assert.ok(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Modal sem overflow');
 await mkdir('artifacts/application-deletion',{recursive:true});await modal.screenshot({path:'artifacts/application-deletion/modal-mobile.png'});
 await modal.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
 await modal.getByRole('button',{name:'Excluir definitivamente',exact:true}).click();await page.waitForURL(`${base}/rh/candidaturas?excluida=1`);
 await page.getByRole('status').filter({hasText:'Candidatura excluída'}).waitFor();assert.equal(await row().count(),0);
 for(const table of ['application_answers','application_events','evaluations','interviews'])assert.equal((await database.query(`select 1 from public.${table} where application_id=$1`,[applications[0]])).rowCount,0,'Registros exclusivos removidos');
 assert.equal((await database.query('select id from public.applications where id=$1',[applications[1]])).rowCount,1,'Outra candidatura preservada');
 assert.equal((await database.query('select id from public.candidates where id=$1',[candidateId])).rowCount,1,'Currículo preservado');
 assert.equal((await database.query('select id from public.profile_entries where candidate_id=$1',[candidateId])).rowCount,1,'Formação preservada');
 assert.ok((await database.query("select id from public.audit_events where resource='applications' and resource_id=$1 and action='DELETE' and actor_id=$2",[applications[0],primary.id])).rowCount,'Exclusão auditada');
 const portal=await browser.newPage();await login(portal,candidate.email);await portal.waitForURL(`${base}/candidato`);
 await portal.goto(`${base}/candidato/candidaturas`);await portal.getByText(`Vaga de exclusão B ${suffix}`,{exact:true}).waitFor();
 assert.equal(await portal.getByText(`Vaga de exclusão A ${suffix}`,{exact:true}).count(),0,'Exclusão refletida no portal');
 console.log('PASS: faixa removida, exclusão exclusiva do principal/MFA, modal e cancelamento, conflito de versão, limpeza do processo, preservação do currículo/outra candidatura, auditoria e portal.');
}finally{
 await browser?.close();
 if(connected){
  for(const table of ['application_answers','application_events','evaluations','interviews'])await database.query(`delete from public.${table} where application_id=any($1::uuid[])`,[applications]);
  await database.query('delete from public.applications where id=any($1::uuid[])',[applications]);
  if(candidateId)await database.query('delete from public.candidates where id=$1',[candidateId]);
  await database.query('delete from public.jobs where id=any($1::uuid[])',[jobs]);
  if(initialPrimary)await database.query('update private.primary_administrator set user_id=$1',[initialPrimary]);
  else await database.query('delete from private.primary_administrator where user_id=any($1::uuid[])',[users]);
  for(const id of users){const removed=await service.auth.admin.deleteUser(id);assert.ok(!removed.error,'Limpeza da fixture local');}
  await database.end();
 }
 server.kill();if(server.exitCode===null&&server.signalCode===null)await new Promise(r=>server.once('exit',r));
}
