begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(17);

select ok(has_function_privilege('service_role','public.bootstrap_password_staff(uuid,text)','EXECUTE'),'Servidor pode provisionar o primeiro gestor');
select ok(not has_function_privilege('authenticated','public.bootstrap_password_staff(uuid,text)','EXECUTE'),'Cadastro comum não pode conceder administração');
select ok(not has_function_privilege('anon','public.consume_signup_quota(text)','EXECUTE'),'Quota é restrita ao servidor');
select ok(not has_table_privilege('authenticated','private.signup_limits','SELECT'),'Hashes de quota não são expostos');

update private.security_config set allow_local_password_staff=false;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000091','password.admin@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000092','password.denied@example.test',now(),'{"provider":"email"}');
insert into public.staff(user_id,display_name,password_login_enabled) values
 ('00000000-0000-4000-8000-000000000091','Administradora de teste',true),
 ('00000000-0000-4000-8000-000000000092','Conta sem autorização',false);
insert into public.staff_roles(user_id,role_id)
 select s.user_id,r.id from public.staff s cross join public.roles r
 where s.user_id in ('00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092') and r.name='Superadministrador';
select ok((select mfa_enabled from public.staff where user_id='00000000-0000-4000-8000-000000000091'),'Gestor por senha mantém MFA ativo');
-- This fixture represents the principal account, not a delegated admin.
update private.primary_administrator set user_id='00000000-0000-4000-8000-000000000091';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select ok(public.is_staff(),'Conta explicitamente autorizada entra na configuração de segurança');
select ok(not public.has_permission('users.manage'),'Senha sozinha não libera administração');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select ok(public.has_permission('users.manage'),'Autenticador libera administração com perfil autorizado');
select ok(public.has_permission('candidates.edit'),'Administrador geral pode editar currículos');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select ok(not public.is_staff(),'Outro usuário por senha não recebe acesso pela flag de outra conta');
select ok(not public.has_permission('users.manage'),'MFA sem autorização do provedor não libera administração');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated","aal":"aal2","app_metadata":{"provider":"other"}}',true);
select ok(not public.is_staff(),'A autorização de senha não libera qualquer outro provedor');
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select ok((select bool_and(public.consume_signup_quota(repeat('a',64))) from generate_series(1,5)),'Primeiras cinco tentativas permitidas');
select ok(not public.consume_signup_quota(repeat('a',64)),'Sexta tentativa por origem bloqueada');
select ok(not public.consume_signup_quota('invalid'),'Chave de quota inválida rejeitada');
select is(public.bootstrap_password_staff('00000000-0000-4000-8000-000000000091','Administradora de teste'),'00000000-0000-4000-8000-000000000091'::uuid,'Bootstrap idempotente não redefine senha ou MFA');
select throws_ok($$select public.bootstrap_password_staff('00000000-0000-4000-8000-000000000092','Outra conta')$$,'P0001','staff_already_exists','Bootstrap não adiciona outro administrador');
select * from finish();
rollback;
