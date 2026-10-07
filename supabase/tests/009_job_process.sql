begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(31);
select ok(not has_function_privilege('authenticated','private.valid_question_options(text,text[])','EXECUTE'),'Helper privado não pode ser executado por usuário comum');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000091','process.staff@example.test',now(),'{}'),
 ('00000000-0000-4000-8000-000000000092','process.candidate@example.test',now(),'{}');
insert into public.staff(user_id,display_name,password_login_enabled) values('00000000-0000-4000-8000-000000000091','Gestor fictício',true);
insert into public.staff_roles(user_id,role_id) select '00000000-0000-4000-8000-000000000091',id from public.roles where name='Superadministrador';
insert into public.jobs(id,title,slug,city,description,work_model,status,visibility) values
 ('00000000-0000-4000-8000-000000000093','Vaga fictícia','process-test','Cidade','Descrição fictícia','Remoto','published','public'),
 ('00000000-0000-4000-8000-000000000094','Outra vaga fictícia','process-test-other','Cidade','Descrição fictícia','Remoto','draft','public');
insert into public.job_stages(id,job_id,name,position) values
 ('00000000-0000-4000-8000-000000000095','00000000-0000-4000-8000-000000000093','Inscrição',0),
 ('00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000093','Triagem',1),
 ('00000000-0000-4000-8000-000000000097','00000000-0000-4000-8000-000000000094','Outra etapa',0);
insert into public.candidates(id,user_id,full_name,email,phone,city,headline,summary,skills) values
 ('00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000092','Pessoa fictícia','process.candidate@example.test','11999999999','Cidade','Analista','Resumo fictício de carreira com mais de trinta caracteres.',array['Excel']);
insert into public.profile_entries(candidate_id,kind,title,organization) values('00000000-0000-4000-8000-000000000098','education','Curso fictício','Instituição fictícia');
update public.privacy_policies set active=false where active;
insert into public.privacy_policies(id,version,title,body,active,published_at) values('00000000-0000-4000-8000-000000000099','process-test','Aviso fictício','Conteúdo fictício',true,now());
create function pg_temp.stages() returns jsonb language sql as $$select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'terminal',terminal) order by position),'[]') from public.job_stages where job_id='00000000-0000-4000-8000-000000000093'$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093','[]','[]')$$,'42501','permission_denied','Candidato não altera etapas');
select throws_ok($$select public.save_job_question('00000000-0000-4000-8000-000000000093','{}')$$,'42501','permission_denied','Candidato não cria pergunta');
select throws_ok($$select public.delete_job_question('00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000099')$$,'42501','permission_denied','Candidato não exclui pergunta');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093','[]','[]')$$,'42501','permission_denied','MFA continua obrigatório');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select lives_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',jsonb_build_array(pg_temp.stages()->1,pg_temp.stages()->0),pg_temp.stages())$$,'Gestor reordena etapas atomicamente');
select is((select name from public.job_stages where job_id='00000000-0000-4000-8000-000000000093' and position=0),'Triagem','Nova ordem persistida');
select lives_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',jsonb_set(pg_temp.stages(),'{0,name}','"Análise inicial"'),pg_temp.stages())$$,'Gestor renomeia etapa');
select lives_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',pg_temp.stages()||'[{"id":"00000000-0000-4000-8000-000000000090","name":"Conclusão","terminal":true}]',pg_temp.stages())$$,'Gestor adiciona etapa final');
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',pg_temp.stages(),'[]')$$,'P0001','job_process_changed','Estado antigo não sobrescreve edição');
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093','[]',pg_temp.stages())$$,'P0001','invalid_stages','Processo não fica vazio');
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',jsonb_set(pg_temp.stages(),'{0,terminal}','true'),pg_temp.stages())$$,'P0001','initial_stage_final','Entrada não pode ser final');
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',pg_temp.stages()||jsonb_build_array(pg_temp.stages()->0),pg_temp.stages())$$,'P0001','invalid_stages','Duplicação de etapa bloqueada');
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',pg_temp.stages()||'[{"id":"00000000-0000-4000-8000-000000000097","name":"Outra etapa","terminal":false}]',pg_temp.stages())$$,'P0001','invalid_stages','Não move etapa de outra vaga');
select lives_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',pg_temp.stages()-2,pg_temp.stages())$$,'Remove etapa sem uso');
select lives_ok($$select public.save_job_question('00000000-0000-4000-8000-000000000093','{"label":"Disponibilidade fictícia?","kind":"choice","options":["Manhã","Tarde"],"required":true}')$$,'Cria pergunta de opção');
select lives_ok($$select public.save_job_question('00000000-0000-4000-8000-000000000093','{"label":"Conte uma experiência fictícia","kind":"text","options":[],"required":false}')$$,'Cria pergunta de texto');
select throws_ok($$select public.save_job_question('00000000-0000-4000-8000-000000000093','{"label":"Pergunta inválida","kind":"choice","options":["Só uma"],"required":false}')$$,'P0001','invalid_question','Opção exige duas alternativas');
select throws_ok($$select public.save_job_question('00000000-0000-4000-8000-000000000093','{"label":"Pergunta inválida","kind":"choice","options":["Igual","Igual"],"required":false}')$$,'P0001','invalid_question','Opções duplicadas rejeitadas');
select lives_ok($$select public.save_job_question('00000000-0000-4000-8000-000000000093','{"label":"Texto revisado fictício","kind":"text","options":[],"required":false}',(select id from public.job_questions where job_id='00000000-0000-4000-8000-000000000093' and kind='text'))$$,'Edita pergunta livre');
select lives_ok($$select public.delete_job_question('00000000-0000-4000-8000-000000000093',(select id from public.job_questions where job_id='00000000-0000-4000-8000-000000000093' and kind='text'))$$,'Remove pergunta livre');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.submit_application('00000000-0000-4000-8000-000000000093','{}','00000000-0000-4000-8000-000000000099')$$,'P0001','answer_required','Candidatura exige resposta obrigatória');
select throws_ok($$select public.submit_application('00000000-0000-4000-8000-000000000093',(select jsonb_object_agg(id::text,'Inventada') from public.job_questions where job_id='00000000-0000-4000-8000-000000000093'),'00000000-0000-4000-8000-000000000099')$$,'P0001','invalid_answer_option','RPC rejeita alternativa adulterada');
select throws_ok($$select public.submit_application('00000000-0000-4000-8000-000000000093','{"pergunta-desconhecida":"Texto"}','00000000-0000-4000-8000-000000000099')$$,'P0001','invalid_answer','RPC rejeita pergunta desconhecida');
select lives_ok($$select public.submit_application('00000000-0000-4000-8000-000000000093',(select jsonb_object_agg(id::text,'Tarde') from public.job_questions where job_id='00000000-0000-4000-8000-000000000093'),'00000000-0000-4000-8000-000000000099')$$,'Candidatura com escolha válida');
select is((select answer from public.application_answers where application_id=(select id from public.applications where candidate_id='00000000-0000-4000-8000-000000000098')),'Tarde','Resposta persistida');
select is((select stage_id from public.applications where candidate_id='00000000-0000-4000-8000-000000000098'),'00000000-0000-4000-8000-000000000096'::uuid,'Candidatura usa primeira etapa reordenada');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',pg_temp.stages()-0,pg_temp.stages())$$,'P0001','stage_in_use','Etapa com candidatura/histórico é preservada');
select throws_ok($$select public.delete_job_question('00000000-0000-4000-8000-000000000093',(select id from public.job_questions where job_id='00000000-0000-4000-8000-000000000093'))$$,'P0001','question_in_use','Pergunta respondida é preservada');
select throws_ok($$select public.save_job_question('00000000-0000-4000-8000-000000000093','{"label":"Outra pergunta","kind":"text","options":[],"required":false}',(select id from public.job_questions where job_id='00000000-0000-4000-8000-000000000093'))$$,'P0001','question_in_use','Pergunta respondida não muda de significado');
select lives_ok($$select public.save_job_stages('00000000-0000-4000-8000-000000000093',jsonb_build_array(pg_temp.stages()->1,pg_temp.stages()->0),pg_temp.stages())$$,'Reordena etapas usadas sem apagar dados');
reset role;
select * from finish();
rollback;
