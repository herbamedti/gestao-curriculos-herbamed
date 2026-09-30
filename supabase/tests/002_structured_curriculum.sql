begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(9);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
values('00000000-0000-4000-8000-000000000011','curriculum@example.test',now(),'{}');
insert into public.candidates(id,user_id,full_name,email,city)
values('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000011','Pessoa de Teste','curriculum@example.test','Joinville');
insert into public.jobs(id,slug,title,city,work_model,description,status,published_at)
values('00000000-0000-4000-8000-000000000013','structured-curriculum-test','Vaga fictícia para teste','Joinville','Presencial','Vaga local para teste de candidatura com currículo estruturado.','published',now());
insert into public.job_stages(job_id,name,position)
values('00000000-0000-4000-8000-000000000013','Inscrição',0);
insert into public.documents(id,candidate_id,kind,original_name,object_path,mime,size_bytes,status)
values('00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000012','resume','antigo.pdf','legacy/antigo.pdf','application/pdf',100,'pending');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);

select ok(array['phone','headline','summary','skills','trajectory'] <@ public.curriculum_missing('00000000-0000-4000-8000-000000000012'),'Itens essenciais ausentes são identificados');
select throws_ok(format('select public.submit_application(%L::uuid, %L::jsonb, (select id from public.privacy_policies where active))','00000000-0000-4000-8000-000000000013','{}'),'P0001','curriculum_incomplete','Candidatura incompleta é bloqueada');
select throws_ok('select public.authorize_download(''00000000-0000-4000-8000-000000000015''::uuid)','42501','permission_denied','Arquivo antigo pendente continua protegido');

reset role;
update public.candidates set phone='(47) 99999-9999',headline='Analista de Qualidade',summary='Experiência em processos, qualidade e melhoria contínua.',skills=array['Qualidade'] where id='00000000-0000-4000-8000-000000000012';
insert into public.profile_entries(candidate_id,kind,title,organization)
values('00000000-0000-4000-8000-000000000012','education','Graduação em Farmácia','Instituição Exemplo');
set local role authenticated;
select is(public.curriculum_missing('00000000-0000-4000-8000-000000000012'),'{}'::text[],'Currículo estruturado completo');
select lives_ok(format('select public.submit_application(%L::uuid, %L::jsonb, (select id from public.privacy_policies where active))','00000000-0000-4000-8000-000000000013','{}'),'Candidatura aceita sem documento no Storage');
select is((select resume_id from public.applications where job_id='00000000-0000-4000-8000-000000000013'),null::uuid,'Nova candidatura não vincula arquivo antigo');
select lives_ok('select public.authorize_curriculum_export(''00000000-0000-4000-8000-000000000012''::uuid)','Titular pode exportar o próprio currículo');
reset role;
select is((select count(*)::integer from public.audit_events where action='export' and resource='curriculum' and resource_id='00000000-0000-4000-8000-000000000012'),1,'Exportação fica registrada na auditoria');
set local role authenticated;
select throws_ok('select public.authorize_curriculum_export(''00000000-0000-4000-8000-000000000099''::uuid)','42501','permission_denied','Currículo de outro titular não pode ser exportado');
reset role;
select * from finish();
rollback;
