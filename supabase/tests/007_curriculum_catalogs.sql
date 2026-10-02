begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(20);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000071','catalog.rh@example.test',now(),'{}'),
 ('00000000-0000-4000-8000-000000000072','catalog.candidate@example.test',now(),'{}');
insert into public.staff(user_id,display_name) values('00000000-0000-4000-8000-000000000071','RH fictício');
insert into public.staff_roles(user_id,role_id) select '00000000-0000-4000-8000-000000000071',id from public.roles where name='Superadministrador';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000072","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok($sql$select public.manage_catalog('employment_types','Teste')$sql$,'42501','permission_denied','Candidato não altera catálogo');
select throws_ok($sql$select public.staff_navigation_permissions()$sql$,'42501','permission_denied','Candidato não consulta navegação RH');
select lives_ok($sql$select public.save_candidate('{"full_name":"Candidato Exemplo","skills":["Excel"],"additional_info":{"driver_license":"AB","travel_available":true,"secondary_phone":"(11) 99999-9999"}}')$sql$,'Candidato salva detalhes opcionais');
select is((select additional_info->>'driver_license' from public.candidates where user_id=auth.uid()),'AB','Habilitação persistida');
select lives_ok($sql$select public.save_profile_entry((select id from public.candidates where user_id=auth.uid()),'{"kind":"language","title":"Inglês","organization":"","level":"Intermediário"}')$sql$,'Idioma sem instituição');
select is((select level from public.profile_entries where candidate_id=(select id from public.candidates where user_id=auth.uid())),'Intermediário','Nível do idioma persistido');
select lives_ok($sql$select public.save_candidate('{"full_name":"Candidato Exemplo","skills":["Excel"]}')$sql$,'Cliente antigo continua salvando');
select is((select additional_info->>'driver_license' from public.candidates where user_id=auth.uid()),'AB','Cliente antigo preserva detalhes');
select throws_ok($sql$select public.save_candidate('{"full_name":"Candidato Exemplo","additional_info":{"driver_license":"ZZ"}}')$sql$,'P0001','invalid_candidate_details','RPC valida detalhes');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000071","role":"authenticated","aal":"aal2","app_metadata":{"provider":"azure"}}',true);
select ok('settings.manage'=any(public.staff_navigation_permissions()),'Navegação reflete permissões reais');
select lives_ok($sql$select public.manage_catalog('experience_levels','Experiência fictícia')$sql$,'RH adiciona nível');
select lives_ok($sql$select public.manage_catalog('experience_levels','Nível editado',(select id from public.experience_levels where name='Experiência fictícia'),false)$sql$,'RH edita e desativa nível');
select is((select active from public.experience_levels where name='Nível editado'),false,'Desativação persistida');
select lives_ok($sql$select public.delete_catalog('experience_levels',(select id from public.experience_levels where name='Nível editado'))$sql$,'RH exclui cadastro livre');
select lives_ok($sql$select public.save_job('{"title":"Vaga fictícia completa","slug":"catalog-job-test","city":"Cidade Exemplo","description":"Descrição fictícia para validar novos catálogos.","work_model":"Presencial","experience_level_id":"","employment_type_id":""}')$sql$,'Vaga aceita novos campos opcionais');
select lives_ok($sql$select public.manage_catalog('employment_types','Emprego fictício')$sql$,'RH cadastra tipo de emprego');
select lives_ok($sql$select public.save_job(jsonb_build_object('title','Vaga fictícia completa','slug','catalog-job-test','city','Cidade Exemplo','description','Descrição fictícia para validar novos catálogos.','work_model','Presencial','employment_type_id',(select id from public.employment_types where name='Emprego fictício')),(select id from public.jobs where slug='catalog-job-test'))$sql$,'Vaga grava tipo de emprego');
select throws_ok($sql$select public.delete_catalog('employment_types',(select id from public.employment_types where name='Emprego fictício'))$sql$,'P0001','catalog_in_use','Exclusão de cadastro em uso é bloqueada');
select lives_ok($sql$select public.create_manual_candidate('{"full_name":"Pessoa Manual Exemplo","email":"catalog.manual@example.test","source":"Teste local","processing_purpose":"Recrutamento","legal_basis":"Teste avaliado","additional_info":{"driver_license":"B","relocation_available":true}}')$sql$,'RH salva detalhes de currículo manual');
select is((select additional_info->>'driver_license' from public.candidates where email='catalog.manual@example.test'),'B','Detalhes do RH persistidos');
reset role;
select * from finish();
rollback;
