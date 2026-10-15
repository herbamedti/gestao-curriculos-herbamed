begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.signup_email_exists(text)','EXECUTE'),'Existência de e-mail não é consulta pública');
select ok(not has_function_privilege('authenticated','public.signup_email_exists(text)','EXECUTE'),'Usuário não enumera cadastros');
select ok(not has_function_privilege('authenticated','public.issue_password_recovery_grant(uuid,uuid,text)','EXECUTE'),'Login comum não emite autorização de recuperação');
select ok(not has_function_privilege('anon','public.consume_password_recovery_grant(text)','EXECUTE'),'Anônimo não consome autorização');
select ok(not has_table_privilege('service_role','private.password_recovery_grants','INSERT'),'Servidor também usa somente RPC');
select ok((select relrowsecurity from pg_class where oid='private.password_recovery_grants'::regclass),'Autorizações privadas têm RLS');
insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000171','signup-guard@example.test','{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000172','other-guard@example.test','{"provider":"email"}');
insert into auth.sessions(id,user_id) values
 ('00000000-0000-4000-8000-000000000173','00000000-0000-4000-8000-000000000171'),
 ('00000000-0000-4000-8000-000000000174','00000000-0000-4000-8000-000000000171'),
 ('00000000-0000-4000-8000-000000000175','00000000-0000-4000-8000-000000000172');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select ok(public.signup_email_exists(' SIGNUP-GUARD@EXAMPLE.TEST '),'Duplicata não confirmada normalizada');
select ok(not public.signup_email_exists('absent-guard@example.test'),'Novo e-mail identificado somente pelo servidor');
select throws_ok($$select public.issue_password_recovery_grant('00000000-0000-4000-8000-000000000171','00000000-0000-4000-8000-000000000175',repeat('a',64))$$,'P0001','invalid_recovery','Sessão de outro titular não recebe autorização');
select lives_ok($$select public.issue_password_recovery_grant('00000000-0000-4000-8000-000000000171','00000000-0000-4000-8000-000000000173',repeat('a',64))$$,'Servidor emite autorização vinculada à sessão');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000172","session_id":"00000000-0000-4000-8000-000000000175"}',true);
select ok(not public.consume_password_recovery_grant(repeat('a',64)),'Outro titular não usa autorização');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000171","session_id":"00000000-0000-4000-8000-000000000174"}',true);
select ok(not public.consume_password_recovery_grant(repeat('a',64)),'Outra sessão do mesmo titular não usa autorização');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000171","session_id":"00000000-0000-4000-8000-000000000173"}',true);
select ok(not public.consume_password_recovery_grant(repeat('b',64)),'Código incorreto não autoriza');
select ok(public.consume_password_recovery_grant(repeat('a',64)),'Titular e sessão corretos autorizados');
select ok(not public.consume_password_recovery_grant(repeat('a',64)),'Autorização de uso único');
reset role;
insert into private.password_recovery_grants(token_hash,user_id,session_id,expires_at)
 values(repeat('b',64),'00000000-0000-4000-8000-000000000171','00000000-0000-4000-8000-000000000173',now()-interval '1 second');
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-000000000171';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select ok(public.signup_email_exists('signup-guard@example.test'),'Duplicata confirmada também detectada');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000171","session_id":"00000000-0000-4000-8000-000000000173"}',true);
select ok(not public.consume_password_recovery_grant(repeat('b',64)),'Autorização expirada negada');
select * from finish();
rollback;
