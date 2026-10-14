begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(30);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000161','job-admin@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000162','job-limited@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000163','job-candidate@example.test',now(),'{"provider":"email"}');
insert into public.staff(user_id,display_name,password_login_enabled) values
 ('00000000-0000-4000-8000-000000000161','RH fictício',true),('00000000-0000-4000-8000-000000000162','Gestor fictício',true);
insert into public.staff_roles(user_id,role_id) select '00000000-0000-4000-8000-000000000161',id from public.roles where name='Recrutador';
insert into public.roles(id,name,scope) values('00000000-0000-4000-8000-000000000164','Vagas atribuídas teste','assigned');
insert into public.staff_roles values('00000000-0000-4000-8000-000000000162','00000000-0000-4000-8000-000000000164');
insert into public.role_permissions(role_id,permission) select '00000000-0000-4000-8000-000000000164',code from public.permissions where code in ('jobs.read','candidates.read','applications.read','applications.move','applications.link','applications.unlink');
insert into public.jobs(id,slug,title,city,work_model,description,status,published_at) values
 ('00000000-0000-4000-8000-000000000165','job-management-a','Vaga fictícia A','Cidade teste','Presencial','Descrição fictícia de oportunidade para testes de gestão.','published',now()),
 ('00000000-0000-4000-8000-000000000166','job-management-b','Vaga fictícia B','Cidade teste','Presencial','Descrição fictícia de oportunidade para testes de gestão.','published',now());
insert into public.job_assignments(job_id,user_id) values('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000162');
insert into public.job_stages(id,job_id,name,position) values
 ('00000000-0000-4000-8000-000000000167','00000000-0000-4000-8000-000000000165','Inscrição',0),
 ('00000000-0000-4000-8000-000000000168','00000000-0000-4000-8000-000000000165','Entrevista',1),
 ('00000000-0000-4000-8000-000000000169','00000000-0000-4000-8000-000000000166','Inscrição',0);
insert into public.candidates(id,user_id,full_name,email,phone,city,headline,summary,skills) values
 ('00000000-0000-4000-8000-000000000170','00000000-0000-4000-8000-000000000163','Pessoa fictícia','job-candidate@example.test','11999999999','Cidade teste','Analista','Resumo profissional fictício para testar a gestão por vaga.',array['Testes']);
insert into public.profile_entries(candidate_id,kind,title,organization) values('00000000-0000-4000-8000-000000000170','education','Curso fictício','Instituição fictícia');
insert into public.applications(id,candidate_id,job_id,stage_id) values
 ('00000000-0000-4000-8000-000000000171','00000000-0000-4000-8000-000000000170','00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000167'),
 ('00000000-0000-4000-8000-000000000172','00000000-0000-4000-8000-000000000170','00000000-0000-4000-8000-000000000166','00000000-0000-4000-8000-000000000169');
insert into public.interviews(application_id,interviewer_id,starts_at,location) values('00000000-0000-4000-8000-000000000171','00000000-0000-4000-8000-000000000161',now()+interval '1 day','Local fictício');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000163","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.list_job_candidates('00000000-0000-4000-8000-000000000165')$$,'42501','permission_denied','Candidato não lista inscritos');
select throws_ok($$select public.search_job_candidate_links('00000000-0000-4000-8000-000000000165','Pessoa')$$,'42501','permission_denied','Candidato não busca currículos para RH');
select throws_ok($$select public.unlink_job_candidate('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000171',now(),'Motivo teste')$$,'42501','permission_denied','Candidato não desvincula administrativamente');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000161","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.list_job_candidates('00000000-0000-4000-8000-000000000165')$$,'42501','permission_denied','MFA exigido pelo RH');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000162","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select is((public.list_job_candidates('00000000-0000-4000-8000-000000000165')->>'total')::integer,1,'Gestor lista a vaga atribuída');
select throws_ok($$select public.list_job_candidates('00000000-0000-4000-8000-000000000166')$$,'42501','permission_denied','Outra vaga não está no escopo');
select throws_ok($$select public.unlink_job_candidate('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000172',now(),'Motivo teste')$$,'42501','permission_denied','Não usa ID da vaga autorizada para alterar outra');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000161","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select is((public.list_job_candidates('00000000-0000-4000-8000-000000000165','% OR 1=1')->>'total')::integer,0,'Busca trata conteúdo como texto');
select ok((select already_linked from public.search_job_candidate_links('00000000-0000-4000-8000-000000000165','Pessoa') where id='00000000-0000-4000-8000-000000000170'),'Busca identifica vínculo existente');
select throws_ok($$select public.update_job_application('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000171',now()-interval '1 day','00000000-0000-4000-8000-000000000168','active','Mover teste')$$,'P0001','application_changed','Edição antiga recusada');
select throws_ok($$select public.update_job_application('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000171',(select updated_at from public.applications where id='00000000-0000-4000-8000-000000000171'),'00000000-0000-4000-8000-000000000169','active','Mover teste')$$,'P0001','invalid_stage','Etapa de outra vaga recusada');
select lives_ok($$select public.update_job_application('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000171',(select updated_at from public.applications where id='00000000-0000-4000-8000-000000000171'),'00000000-0000-4000-8000-000000000168','active','Entrevista após análise')$$,'RH edita etapa');
select is((public.list_job_candidates('00000000-0000-4000-8000-000000000165','', '00000000-0000-4000-8000-000000000167')->>'total')::integer,0,'Filtro da etapa anterior fica vazio');
select throws_ok($$select public.unlink_job_candidate('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000171',(select updated_at from public.applications where id='00000000-0000-4000-8000-000000000171'),'')$$,'P0001','application_reason_required','Desvincular exige motivo');
select lives_ok($$select public.unlink_job_candidate('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000171',(select updated_at from public.applications where id='00000000-0000-4000-8000-000000000171'),'Inclusão incorreta corrigida')$$,'RH desvincula');
select is((select count(*)::integer from public.candidates where id='00000000-0000-4000-8000-000000000170'),1,'Currículo preservado');
select is((select status from public.applications where id='00000000-0000-4000-8000-000000000172'),'active','Outra vaga preservada');
select is((select status from public.interviews where application_id='00000000-0000-4000-8000-000000000171'),'cancelled','Entrevista futura cancelada');
select is((public.list_job_candidates('00000000-0000-4000-8000-000000000165')->>'total')::integer,0,'Lista atual exclui desvinculados');
select is((public.list_job_candidates('00000000-0000-4000-8000-000000000165','',null,'unlinked')->>'total')::integer,1,'Filtro de histórico encontra desvinculado');
select throws_ok($$select public.schedule_interview('00000000-0000-4000-8000-000000000171',now()+interval '2 days','Local fictício')$$,'P0001','application_changed','RPC não agenda candidato removido');
select ok(not (select already_linked from public.search_job_candidate_links('00000000-0000-4000-8000-000000000165','Pessoa') where id='00000000-0000-4000-8000-000000000170'),'Busca permite novo vínculo do removido');
select lives_ok($$select public.link_candidate_to_job('00000000-0000-4000-8000-000000000170','00000000-0000-4000-8000-000000000165','Retorno ao processo autorizado')$$,'RH vincula novamente');
select is((select count(*)::integer from public.applications where candidate_id='00000000-0000-4000-8000-000000000170' and job_id='00000000-0000-4000-8000-000000000165'),1,'Novo vínculo reutiliza mesma candidatura');
select is((select stage_id from public.applications where id='00000000-0000-4000-8000-000000000171'),'00000000-0000-4000-8000-000000000167'::uuid,'Novo vínculo volta à primeira etapa');
select is((select count(*)::integer from public.application_events where application_id='00000000-0000-4000-8000-000000000171'),3,'Histórico de edição, retirada e retorno preservado');
select is((select status from public.interviews where application_id='00000000-0000-4000-8000-000000000171'),'cancelled','Retorno não ressuscita entrevistas canceladas');
select ok(not has_table_privilege('authenticated','public.applications','UPDATE'),'Sem escrita direta na tabela');
select is(jsonb_array_length(public.list_job_candidates('00000000-0000-4000-8000-000000000165','',null,'all',2)->'rows'),0,'Pagina vazia não inventa candidatos');
reset role;
insert into private.staff_permission_overrides(user_id,permission,allowed) values('00000000-0000-4000-8000-000000000161','applications.unlink',false);
set local role authenticated;
select throws_ok($$select public.unlink_job_candidate('00000000-0000-4000-8000-000000000165','00000000-0000-4000-8000-000000000171',(select updated_at from public.applications where id='00000000-0000-4000-8000-000000000171'),'Remover teste novamente')$$,'42501','permission_denied','Bloqueio individual de desvinculação respeitado');
select * from finish();
rollback;
