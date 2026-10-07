begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000141','google-pending@example.test',now(),'{"provider":"google"}'),
 ('00000000-0000-4000-8000-000000000142','google-staff@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000143','google-legacy@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000144','google-unverified@example.test',now(),'{"provider":"google"}'),
 ('00000000-0000-4000-8000-000000000145','google-disabled@example.test',now(),'{"provider":"google"}'),
 ('00000000-0000-4000-8000-000000000146','google-quota@example.test',now(),'{"provider":"google"}');
insert into auth.identities(id,user_id,provider,provider_id,identity_data)
 select gen_random_uuid(),id,'google',id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',id!='00000000-0000-4000-8000-000000000144'::uuid)
 from auth.users where id in ('00000000-0000-4000-8000-000000000141','00000000-0000-4000-8000-000000000142','00000000-0000-4000-8000-000000000143','00000000-0000-4000-8000-000000000144','00000000-0000-4000-8000-000000000145','00000000-0000-4000-8000-000000000146');
insert into public.staff(user_id,display_name,password_login_enabled) values('00000000-0000-4000-8000-000000000142','Equipe fictícia',true);
insert into public.staff_roles select '00000000-0000-4000-8000-000000000142',id from public.roles where name='Superadministrador';
insert into public.candidates(id,user_id,full_name,email) values('00000000-0000-4000-8000-000000000147','00000000-0000-4000-8000-000000000143','Pessoa fictícia','google-legacy@example.test');
insert into private.portal_account_access(user_id,active,reason,changed_by,revoked_before) values('00000000-0000-4000-8000-000000000145',false,'Teste','00000000-0000-4000-8000-000000000142',now());
create function pg_temp.claims(p_id text,p_provider text default 'google',p_method text default 'oauth') returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',p_id,'role','authenticated','aal','aal2','app_metadata',jsonb_build_object('provider',p_provider),'amr',jsonb_build_array(jsonb_build_object('method',p_method)))::text,true)
$$;
select ok((select relrowsecurity from pg_class where oid='private.google_candidate_accounts'::regclass),'Marcador Google protegido por RLS');
select ok(not has_table_privilege('authenticated','private.google_candidate_accounts','SELECT'),'Marcadores privados');
select ok(not has_function_privilege('authenticated','private.portal_account_allowed()','EXECUTE'),'Gate original privado sem bypass');
select ok(not has_function_privilege('anon','public.complete_google_registration(text,date)','EXECUTE'),'Visitante não completa cadastro');
select ok(not has_function_privilege('authenticated','public.consume_google_oauth_quota(text)','EXECUTE'),'Quota de início exclusiva de servidor');
select is((select count(*)::integer from private.google_candidate_accounts where user_id::text like '%00000000014_'),6,'Identidades Google marcadas pelo trigger');

select ok(has_function_privilege('supabase_auth_admin','public.guard_candidate_signup(jsonb)','EXECUTE'),'Hook autorizado ao serviço Auth');
select is(public.guard_candidate_signup('{"user":{"email":"google@example.test","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true}},"metadata":{"ip_address":"192.0.2.141"}}'), '{}'::jsonb,'Hook permite Google com e-mail verificado');
select is(public.guard_candidate_signup('{"user":{"email":"google@example.test","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":false}}}')#>>'{error,http_code}', '403','Hook rejeita Google sem verificação');
select is(public.guard_candidate_signup('{"user":{"email":"bad@","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true}}}')#>>'{error,http_code}', '403','Hook rejeita e-mail inválido');
select is(public.guard_candidate_signup('{"user":{"email":"google@example.test","app_metadata":{"provider":"email"},"user_metadata":{"email_verified":true,"provider":"google"}}}')#>>'{error,http_code}', '403','Metadata de usuário não falsifica provedor confiável');
select is((select count(*)::integer from generate_series(1,4) where public.guard_candidate_signup('{"user":{"email":"google@example.test","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true}},"metadata":{"ip_address":"192.0.2.141"}}')='{}'::jsonb),4,'Até cinco novos cadastros Google por origem/hora');
select is(public.guard_candidate_signup('{"user":{"email":"google@example.test","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true}},"metadata":{"ip_address":"192.0.2.141"}}')#>>'{error,http_code}', '429','Hook limita novos cadastros OAuth');
reset role;

set local role authenticated;
select pg_temp.claims('00000000-0000-4000-8000-000000000141');
select is(public.candidate_registration_status(),'required','Primeiro acesso Google exige identificação');
select ok(not public.portal_session_allowed(),'Área do candidato bloqueada antes de identificar');
select throws_ok($$select public.save_candidate('{}')$$,'42501','portal_access_disabled','Não pula cadastro pelo RPC');
select throws_ok($$select public.export_my_data()$$,'42501','portal_access_disabled','Não exporta dados antes de identificar');
select is(public.complete_google_registration('52998224724','1995-06-15')->>'error','invalid_registration','CPF inválido recusado no banco');
select is(public.complete_google_registration(null,'1995-06-15')->>'error','invalid_registration','CPF nulo recusado');
select is(public.complete_google_registration('52998224725','2099-01-01')->>'error','invalid_registration','Nascimento futuro recusado');
select is(public.complete_google_registration('52998224725',null)->>'error','invalid_registration','Nascimento obrigatório');
select is(public.complete_google_registration('52998224725','1995-06-15')->>'ok','true','Dados válidos concluem cadastro');
select is(public.candidate_registration_status(),'complete','Identificação libera candidato');
select ok(public.portal_session_allowed(),'Gate permite acesso após CPF e nascimento');
select ok(not public.is_staff(),'Google não concede acesso interno');
select lives_ok($$select public.export_my_data()$$,'Exportação disponível depois de completar');
select is(public.complete_google_registration('11144477735','1990-01-01')->>'ok','true','Repetição idempotente');
reset role;
select is((select cpf from private.candidate_registration where user_id='00000000-0000-4000-8000-000000000141'),'52998224725','Não sobrescreve identificação existente');
select is((select count from private.rate_limits where user_id='00000000-0000-4000-8000-000000000141' and action='google_registration'),6,'Tentativas inválidas continuam contadas');
select ok(not exists(select 1 from public.staff where user_id='00000000-0000-4000-8000-000000000141'),'Cadastro não cria perfil interno');

set local role authenticated;
select pg_temp.claims('00000000-0000-4000-8000-000000000143','email');
select is(public.candidate_registration_status(),'required','Conta antiga vinculada ao Google também exige CPF faltante');
select is((select count(*)::integer from public.candidates),0,'RLS oculta currículo antigo antes de identificar');
select ok(not public.owns_candidate('00000000-0000-4000-8000-000000000147'),'Função existente usa o novo gate');
reset role;
delete from auth.identities where user_id='00000000-0000-4000-8000-000000000143' and provider='google';
set local role authenticated;
select is(public.candidate_registration_status(),'required','Desvincular Google não evita a identificação');
select throws_ok($$select public.complete_google_registration('52998224725','1995-06-15')$$,'42501','permission_denied','Conclusão exige identidade Google verificada');
select pg_temp.claims('00000000-0000-4000-8000-000000000144');
select throws_ok($$select public.complete_google_registration('52998224725','1995-06-15')$$,'42501','permission_denied','Identidade Google não verificada recusada');
select pg_temp.claims('00000000-0000-4000-8000-000000000145');
select is(public.candidate_registration_status(),'unavailable','Moderação continua bloqueando conta Google');
select throws_ok($$select public.complete_google_registration('52998224725','1995-06-15')$$,'42501','permission_denied','Conta desativada não completa cadastro');
select pg_temp.claims('00000000-0000-4000-8000-000000000142','email','oauth');
select ok(not public.is_staff(),'OAuth Google vinculado à equipe não concede acesso mesmo com provider legado email/AAL2');
select ok(not public.has_permission('candidates.read'),'RBAC interno nega OAuth Google');
select is(public.candidate_registration_status(),'unavailable','Sessão interna via Google recusada');
select pg_temp.claims('00000000-0000-4000-8000-000000000142','email','password');
select ok(public.is_staff(),'Senha interna autorizada preservada');
select ok(public.has_permission('candidates.read'),'Permissões e MFA internos preservados');
select is(public.candidate_registration_status(),'complete','Equipe não precisa de CPF pelo fluxo candidato');
select throws_ok($$select public.complete_google_registration('52998224725','1995-06-15')$$,'42501','permission_denied','Equipe não utiliza RPC de cadastro Google');
select pg_temp.claims('00000000-0000-4000-8000-000000000146');
select is((select count(*)::integer from generate_series(1,10) where public.complete_google_registration('52998224724','1995-06-15')->>'error'='invalid_registration'),10,'Erros consomem limite de identificação');
select is(public.complete_google_registration('52998224725','1995-06-15')->>'error','rate_limit','Quota de identificação impede abuso direto');
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is((select count(*)::integer from generate_series(1,10) where public.consume_google_oauth_quota(repeat('a',64))),10,'Dez inícios Google permitidos por minuto');
select ok(not public.consume_google_oauth_quota(repeat('a',64)),'Quota limita rajada OAuth');
select ok(not public.consume_google_oauth_quota('invalid'),'Chave inválida rejeitada');
reset role;
insert into private.signup_limits(key,bucket,count) values('google-start:'||repeat('b',64),date_trunc('hour',now()),30);
set local role service_role;
select ok(not public.consume_google_oauth_quota(repeat('b',64)),'Quota também limita por hora');
reset role;
select * from finish();
rollback;
