import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

let status;
try { status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch { console.error('Inicie o Supabase com npm run db:start antes de configurar o ambiente.');process.exit(1); }
const api=status.API_URL;
const anon=status.ANON_KEY;
const service=status.SERVICE_ROLE_KEY;
if(!api||!anon||!service)throw new Error('Supabase local não retornou chaves.');
const lines=[
 'APP_ENV=local','APP_NAME=Herbamed Carreiras','APP_URL=http://localhost:3000',
 `SUPABASE_URL=${api}`,`SUPABASE_ANON_KEY=${anon}`,`SUPABASE_SERVICE_ROLE_KEY=${service}`,
 `NEXT_PUBLIC_SUPABASE_URL=${api}`,`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
 'SIGNED_URL_TTL_SECONDS=60','CLAMAV_HOST=127.0.0.1','CLAMAV_PORT=3310',
 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres',
 'SMTP_HOST=127.0.0.1','SMTP_PORT=54325','SMTP_SECURE=false','SMTP_FROM=Herbamed Carreiras <carreiras@example.test>',
].join('\n')+'\n';
await Promise.all([writeFile('.env.local',lines),writeFile('.env',lines)]);
const client=createClient(api,service,{auth:{persistSession:false,autoRefreshToken:false}});
const demoPassword=randomBytes(18).toString('base64url');
const rhEmail='rh.demo@herbamed.test';
const candidateEmail='candidata.demo@example.test';
async function user(email) {
  const {data,error}=await client.auth.admin.createUser({email,password:demoPassword,email_confirm:true,user_metadata:{local_demo:true}});
  if(error) {
    if(!error.message.toLowerCase().includes('already')) throw error;
    const users=await client.auth.admin.listUsers({perPage:1000});
    const existing=users.data.users.find(u=>u.email===email);
    if(!existing)throw error;
    await client.auth.admin.updateUserById(existing.id,{password:demoPassword});
    return existing;
  }
  return data.user;
}
const [rh,candidate]=await Promise.all([user(rhEmail),user(candidateEmail)]);
const factors=await client.auth.admin.mfa.listFactors({userId:rh.id});
if(factors.error)throw factors.error;
for(const factor of factors.data.factors){const deleted=await client.auth.admin.mfa.deleteFactor({userId:rh.id,id:factor.id});if(deleted.error)throw deleted.error;}
const {data:role,error:roleError}=await client.from('roles').select('id').eq('name','Administrador RH').single();
if(roleError||!role)throw roleError;
const staff=await client.from('staff').upsert({user_id:rh.id,display_name:'Equipe RH — demonstração',active:true});
if(staff.error)throw staff.error;
const assignment=await client.from('staff_roles').upsert({user_id:rh.id,role_id:role.id});
if(assignment.error)throw assignment.error;
const profile=await client.from('candidates').upsert({user_id:candidate.id,email:candidateEmail,full_name:'Marina Exemplo',city:'Joinville',state:'SC',headline:'Profissional de qualidade',skills:['Qualidade','Processos'],source:'seed-local',processing_purpose:'teste_local',legal_basis:'dados_ficticios',talent_pool:true},{onConflict:'user_id'}).select('id').single();
if(profile.error)throw profile.error;
const jobs=await client.from('jobs').select('id').eq('status','published').limit(1);
if(jobs.data?.[0]) {
  const stages=await client.from('job_stages').select('id').eq('job_id',jobs.data[0].id).order('position').limit(1);
  if(stages.data?.[0])await client.from('applications').upsert({candidate_id:profile.data.id,job_id:jobs.data[0].id,stage_id:stages.data[0].id,status:'active'},{onConflict:'candidate_id,job_id'});
}
console.log('Ambiente local configurado. Credenciais de TESTE (trocam a cada setup):');
console.log(`RH: ${rhEmail}`);
console.log(`Candidata: ${candidateEmail}`);
console.log(`Senha temporária para ambos: ${demoPassword}`);
console.log('Acesso local com senha para RH é permitido APENAS no banco local. Antes de produção, configurar Entra ID e MFA.');
console.log('Fatores MFA antigos da conta RH de demonstração foram removidos; cadastre um novo em /seguranca.');
