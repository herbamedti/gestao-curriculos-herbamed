begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.account_area()','EXECUTE'),'Classificação não é um diretório público de usuários');
select ok(not has_function_privilege('authenticated','private.require_candidate_account()','EXECUTE'),'Guard privado não é exposto');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000181','area-primary@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000182','area-candidate@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000183','area-rh@example.test',now(),'{"provider":"email"}');
insert into public.staff(user_id,display_name,password_login_enabled,mfa_enabled) values
 ('00000000-0000-4000-8000-000000000181','Principal fictício',true,true),
 ('00000000-0000-4000-8000-000000000183','RH fictício',true,false);
insert into public.staff_roles select '00000000-0000-4000-8000-000000000181',id from public.roles where name='Superadministrador';
update private.primary_administrator set user_id='00000000-0000-4000-8000-000000000181';
update private.security_config set allow_local_password_staff=false;
insert into public.candidates(id,user_id,email,full_name) values
 ('00000000-0000-4000-8000-000000000185','00000000-0000-4000-8000-000000000182','area-candidate@example.test','Pessoa fictícia'),
 ('00000000-0000-4000-8000-000000000186','00000000-0000-4000-8000-000000000181','area-primary@example.test','Registro histórico fictício');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000182","aal":"aal1","app_metadata":{"provider":"email"},"user_metadata":{"role":"admin","perfil":"rh"}}',true);
select is(public.account_area(),'candidate','Metadata editável não promove candidato');
select ok(public.owns_candidate('00000000-0000-4000-8000-000000000185'),'Titular candidato mantém propriedade');
select ok(not public.has_permission('users.manage'),'Candidato não recebe gestão de equipe');
select lives_ok($$select public.save_candidate('{"full_name":"Pessoa fictícia atualizada"}')$$,'Candidato mantém edição própria');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000181","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select is(public.account_area(),'staff_mfa','Principal precisa concluir MFA antes da gestão');
select ok(not public.owns_candidate('00000000-0000-4000-8000-000000000186'),'Registro antigo não concede identidade de candidato ao gestor');
select throws_ok($$select public.save_candidate('{"full_name":"Currículo indevido"}')$$,'42501','permission_denied','Gestor não cria currículo próprio por RPC');
select throws_ok($$select public.save_privacy('00000000-0000-4000-8000-000000000199',true)$$,'42501','permission_denied','Gestor não entra no banco como candidato');
select throws_ok($$select public.submit_application('00000000-0000-4000-8000-000000000199','{}','00000000-0000-4000-8000-000000000199')$$,'42501','permission_denied','Gestor não se candidata por chamada direta');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000181","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select is(public.account_area(),'staff','Principal com MFA pertence à gestão');
select lives_ok($$select public.save_candidate('{"full_name":"Pessoa gerenciada"}','00000000-0000-4000-8000-000000000185')$$,'Gestão autorizada de currículo de candidato preservada');
select throws_ok($$select public.withdraw_application('00000000-0000-4000-8000-000000000199')$$,'42501','permission_denied','Gestor não usa desistência pessoal do candidato');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000183","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select is(public.account_area(),'staff','MFA opcional do RH respeitado sem virar candidato');
reset role;
update public.staff set active=false where user_id='00000000-0000-4000-8000-000000000183';
set local role authenticated;
select is(public.account_area(),'unavailable','RH desativado não cai no portal de candidatos');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000181","aal":"aal2","app_metadata":{"provider":"google"}}',true);
select is(public.account_area(),'unavailable','Provedor não autorizado não recebe fallback de candidato');
select * from finish();
rollback;
