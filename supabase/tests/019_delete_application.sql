begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.delete_application(uuid,timestamptz)','EXECUTE'),'Anônimo não executa exclusão');
select ok(not has_function_privilege('service_role','public.delete_application(uuid,timestamptz)','EXECUTE'),'Exclusão não é delegada a service role');
select ok(not has_table_privilege('authenticated','public.applications','DELETE'),'Escrita direta continua proibida');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000191','delete-primary@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000192','delete-delegated@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000193','delete-candidate@example.test',now(),'{"provider":"email"}');
insert into public.staff(user_id,display_name,password_login_enabled) values
 ('00000000-0000-4000-8000-000000000191','Principal fictício',true),
 ('00000000-0000-4000-8000-000000000192','Delegado fictício',true);
insert into public.staff_roles select u,r.id from unnest(array['00000000-0000-4000-8000-000000000191'::uuid,'00000000-0000-4000-8000-000000000192'::uuid]) u cross join public.roles r where r.name='Superadministrador';
update private.primary_administrator set user_id='00000000-0000-4000-8000-000000000191';
update private.security_config set allow_local_password_staff=false;
insert into public.jobs(id,title,slug,city,work_model,description) values
 ('00000000-0000-4000-8000-000000000194','Vaga de exclusão fictícia','delete-fixture-1','Cidade teste','Remoto','Descrição fictícia para testar a exclusão de uma candidatura.'),
 ('00000000-0000-4000-8000-000000000195','Outra vaga fictícia','delete-fixture-2','Cidade teste','Remoto','Descrição fictícia de outra vaga que deve permanecer intacta.');
insert into public.job_stages(id,job_id,name,position) values
 ('00000000-0000-4000-8000-000000000196','00000000-0000-4000-8000-000000000194','Inscrição',0),
 ('00000000-0000-4000-8000-000000000197','00000000-0000-4000-8000-000000000195','Inscrição',0);
insert into public.candidates(id,user_id,full_name,email) values('00000000-0000-4000-8000-000000000198','00000000-0000-4000-8000-000000000193','Pessoa fictícia','delete-candidate@example.test');
insert into public.profile_entries(candidate_id,kind,title,organization) values('00000000-0000-4000-8000-000000000198','education','Curso fictício','Instituição fictícia');
insert into public.applications(id,candidate_id,job_id,stage_id) values
 ('00000000-0000-4000-8000-000000000199','00000000-0000-4000-8000-000000000198','00000000-0000-4000-8000-000000000194','00000000-0000-4000-8000-000000000196'),
 ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000198','00000000-0000-4000-8000-000000000195','00000000-0000-4000-8000-000000000197');
insert into public.job_questions(id,job_id,label,position) values('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000194','Pergunta fictícia',0);
insert into public.application_answers(application_id,question_id,answer) values('00000000-0000-4000-8000-000000000199','00000000-0000-4000-8000-000000000201','Resposta fictícia');
insert into public.application_events(application_id,to_stage,note) values('00000000-0000-4000-8000-000000000199','00000000-0000-4000-8000-000000000196','Histórico fictício');
insert into public.evaluations(application_id,author_id,kind,body) values('00000000-0000-4000-8000-000000000199','00000000-0000-4000-8000-000000000191','note','Avaliação fictícia');
insert into public.interviews(application_id,interviewer_id,starts_at,location) values('00000000-0000-4000-8000-000000000199','00000000-0000-4000-8000-000000000191',now()+interval '1 day','Local fictício');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000193","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.delete_application('00000000-0000-4000-8000-000000000199',now())$$,'42501','permission_denied','Candidato não exclui a própria candidatura');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000192","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.delete_application('00000000-0000-4000-8000-000000000199',now())$$,'42501','permission_denied','Superadministrador delegado não exclui');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000191","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.delete_application('00000000-0000-4000-8000-000000000199',now())$$,'42501','permission_denied','Principal sem MFA não exclui');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000191","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.delete_application('00000000-0000-4000-8000-000000000199','2000-01-01')$$,'P0001','application_changed','Versão antiga não exclui processo alterado');
select throws_ok($$select public.delete_application('00000000-0000-4000-8000-000000000199',null)$$,'P0001','application_changed','Versão é obrigatória');
select is((select count(*) from public.interviews where application_id='00000000-0000-4000-8000-000000000199'),1::bigint,'Falhas não excluem dependências');
select lives_ok($$select public.delete_application('00000000-0000-4000-8000-000000000199',(select updated_at from public.applications where id='00000000-0000-4000-8000-000000000199'))$$,'Principal com MFA exclui processo completo');
reset role;
select ok(not exists(select 1 from public.applications where id='00000000-0000-4000-8000-000000000199'),'Candidatura removida definitivamente');
select ok(not exists(select 1 from public.interviews where application_id='00000000-0000-4000-8000-000000000199'),'Entrevistas removidas');
select ok(not exists(select 1 from public.evaluations where application_id='00000000-0000-4000-8000-000000000199'),'Avaliações removidas');
select ok(not exists(select 1 from public.application_answers where application_id='00000000-0000-4000-8000-000000000199'),'Respostas removidas');
select ok(not exists(select 1 from public.application_events where application_id='00000000-0000-4000-8000-000000000199'),'Histórico de etapas removido');
select ok(exists(select 1 from public.applications where id='00000000-0000-4000-8000-000000000200'),'Outra candidatura preservada');
select ok(exists(select 1 from public.profile_entries where candidate_id='00000000-0000-4000-8000-000000000198'),'Conteúdo do currículo preservado');
select ok(exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000193'),'Conta do candidato preservada');
select ok(exists(select 1 from public.audit_events where resource='applications' and resource_id='00000000-0000-4000-8000-000000000199' and action='DELETE' and actor_id='00000000-0000-4000-8000-000000000191'),'Auditoria preserva quem excluiu e qual registro');
update public.applications set status='closed',unlinked_at=now() where id='00000000-0000-4000-8000-000000000200';
set local role authenticated;
select lives_ok($$select public.delete_application('00000000-0000-4000-8000-000000000200',(select updated_at from public.applications where id='00000000-0000-4000-8000-000000000200'))$$,'Candidatura já desvinculada também pode ser excluída');
select throws_ok($$select public.delete_application('00000000-0000-4000-8000-000000000200',now())$$,'P0001','application_changed','Repetição de exclusão é recusada');
select * from finish();
rollback;
