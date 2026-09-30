begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(17);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
('00000000-0000-4000-8000-000000000021','rh.curriculum@example.test',now(),'{}'),
('00000000-0000-4000-8000-000000000022','outsider.curriculum@example.test',now(),'{}');
insert into public.staff(user_id,display_name) values('00000000-0000-4000-8000-000000000021','RH de Teste');
insert into public.staff_roles(user_id,role_id)
select '00000000-0000-4000-8000-000000000021',id from public.roles where name='Administrador RH';
insert into public.jobs(id,slug,title,city,work_model,description,status,published_at)
values('00000000-0000-4000-8000-000000000023','staff-link-test','Vaga de Teste RH','Joinville','Presencial','Vaga fictícia para testar o vínculo manual pelo RH.','published',now());
insert into public.job_stages(job_id,name,position) values('00000000-0000-4000-8000-000000000023','Inscrição',0);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000022","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok('select public.create_manual_candidate(''{}''::jsonb)','42501','permission_denied','Pessoa comum não cria candidato manual');
select throws_ok('select public.link_candidate_to_job(''00000000-0000-4000-8000-000000000099''::uuid,''00000000-0000-4000-8000-000000000023''::uuid,''Teste de vínculo'')','42501','permission_denied','Pessoa comum não vincula vaga');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated","aal":"aal1","app_metadata":{"provider":"azure"}}',true);
select ok(not public.has_permission('applications.link'),'RH sem MFA não pode vincular');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated","aal":"aal2","app_metadata":{"provider":"azure"}}',true);
select lives_ok($sql$select public.create_manual_candidate('{"full_name":"Candidata Manual","email":"manual.curriculum@example.test","phone":"(47) 99999-9999","city":"Joinville","headline":"Analista","summary":"Profissional fictícia com atuação em qualidade e processos.","skills":["Qualidade"],"source":"Indicação local","processing_purpose":"Recrutamento e seleção","legal_basis":"Base de teste avaliada","interests":[]}'::jsonb)$sql$,'RH cria currículo manual com dados completos');
select is((select phone from public.candidates where email='manual.curriculum@example.test'),'(47) 99999-9999','Dados completos foram salvos');
select throws_ok($sql$select public.link_candidate_to_job((select id from public.candidates where email='manual.curriculum@example.test'),'00000000-0000-4000-8000-000000000023','Indicação para a vaga')$sql$,'P0001','curriculum_incomplete','Vínculo exige trajetória completa');
select lives_ok($sql$select public.manage_candidate_curriculum((select id from public.candidates where email='manual.curriculum@example.test'),'{"full_name":"Candidata Manual Editada","email":"manual.curriculum@example.test","phone":"(47) 98888-8888","city":"Joinville","headline":"Analista de Qualidade","summary":"Profissional fictícia com atuação em qualidade e processos.","skills":["Qualidade","Processos"],"source":"Indicação local","processing_purpose":"Recrutamento e seleção","legal_basis":"Base de teste avaliada","interests":[]}'::jsonb)$sql$,'RH edita currículo manual');
select lives_ok($sql$select public.save_profile_entry((select id from public.candidates where email='manual.curriculum@example.test'),'{"kind":"education","title":"Formação em Farmácia","organization":"Instituição Exemplo"}'::jsonb)$sql$,'RH adiciona formação');
select lives_ok($sql$select public.link_candidate_to_job((select id from public.candidates where email='manual.curriculum@example.test'),'00000000-0000-4000-8000-000000000023','Indicação para a vaga')$sql$,'RH vincula currículo completo a vaga publicada');
select is((select resume_id from public.applications where job_id='00000000-0000-4000-8000-000000000023'),null::uuid,'Vínculo usa currículo estruturado sem arquivo');
select throws_ok($sql$select public.link_candidate_to_job((select id from public.candidates where email='manual.curriculum@example.test'),'00000000-0000-4000-8000-000000000023','Indicação para a vaga')$sql$,'P0001','already_linked','Vínculo duplicado é recusado');
select lives_ok($sql$select public.update_profile_entry((select id from public.candidates where email='manual.curriculum@example.test'),(select id from public.profile_entries where title='Formação em Farmácia' limit 1),'{"kind":"education","title":"Formação em Farmácia","organization":"Nova Instituição","description":"Conclusão fictícia"}'::jsonb)$sql$,'RH edita formação do currículo');
select is((select organization from public.profile_entries where title='Formação em Farmácia' limit 1),'Nova Instituição','Edição de formação foi persistida');
select lives_ok($sql$select public.save_profile_entry((select id from public.candidates where email='manual.curriculum@example.test'),'{}'::jsonb,(select id from public.profile_entries where title='Formação em Farmácia' limit 1))$sql$,'RH remove formação do currículo');
select is((select count(*)::integer from public.profile_entries where candidate_id=(select id from public.candidates where email='manual.curriculum@example.test')),0,'Formação removida sem apagar a candidatura existente');

reset role;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
values('00000000-0000-4000-8000-000000000024','portal.curriculum@example.test',now(),'{}');
insert into public.candidates(id,user_id,full_name,email,city)
values('00000000-0000-4000-8000-000000000025','00000000-0000-4000-8000-000000000024','Pessoa do Portal','portal.curriculum@example.test','Joinville');
set local role authenticated;
select lives_ok($sql$select public.manage_candidate_curriculum('00000000-0000-4000-8000-000000000025','{"full_name":"Pessoa do Portal","email":"portal.curriculum@example.test","phone":"(47) 97777-7777","city":"Joinville","headline":"Analista","summary":"Resumo preenchido pela equipe de recrutamento para teste local.","skills":["Processos"],"interests":[]}'::jsonb)$sql$,'RH edita currículo criado pela própria pessoa');
select throws_ok($sql$select public.manage_candidate_curriculum('00000000-0000-4000-8000-000000000025','{"full_name":"Pessoa do Portal","email":"outro@example.test","phone":"(47) 97777-7777","city":"Joinville","headline":"Analista","summary":"Resumo preenchido pela equipe de recrutamento para teste local.","skills":["Processos"],"interests":[]}'::jsonb)$sql$,'P0001','login_email_locked','RH não altera e-mail de login da conta do portal');
reset role;
select * from finish();
rollback;
