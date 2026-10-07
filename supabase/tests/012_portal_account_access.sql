begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000121','portal-owner@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000122','portal-primary@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000123','portal-delegated@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-4000-8000-000000000124','portal-empty@example.test',null,'{"provider":"email"}');
insert into public.staff(user_id,display_name,password_login_enabled) values
 ('00000000-0000-4000-8000-000000000122','Principal fictício',true),
 ('00000000-0000-4000-8000-000000000123','Delegado fictício',true);
insert into public.staff_roles select u,r.id from unnest(array['00000000-0000-4000-8000-000000000122'::uuid,'00000000-0000-4000-8000-000000000123'::uuid]) u cross join public.roles r where r.name='Superadministrador';
update private.primary_administrator set user_id='00000000-0000-4000-8000-000000000122';
insert into auth.sessions(id,user_id,created_at,updated_at) values('00000000-0000-4000-8000-000000000125','00000000-0000-4000-8000-000000000121',now()-interval '1 hour',now());
insert into public.candidates(id,user_id,full_name,email,talent_pool) values('00000000-0000-4000-8000-000000000126','00000000-0000-4000-8000-000000000121','Pessoa fictícia','portal-owner@example.test',true);
insert into public.notifications(user_id,title,body) values('00000000-0000-4000-8000-000000000121','Teste','Mensagem fictícia');

select ok((select relrowsecurity from pg_class where oid='private.portal_account_access'::regclass),'Restrições com RLS');
select ok(not has_table_privilege('authenticated','private.portal_account_access','SELECT'),'Restrições não são públicas');
select ok(not has_function_privilege('anon','public.list_portal_accounts(text,boolean,integer)','EXECUTE'),'Visitante não lista contas');
select ok(not has_function_privilege('authenticated','private.save_candidate_portal_base(jsonb,uuid)','EXECUTE'),'Implementação privada não permite bypass');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000121","role":"authenticated","session_id":"00000000-0000-4000-8000-000000000125","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select ok(public.portal_session_allowed(),'Conta sem restrição tem acesso');
select ok(public.owns_candidate('00000000-0000-4000-8000-000000000126'),'Candidato vê seu currículo');
select throws_ok($$select public.list_portal_accounts()$$,'42501','permission_denied','Candidato não lista contas');
select throws_ok($$select public.set_portal_account_access('00000000-0000-4000-8000-000000000124',false,'Teste')$$,'42501','permission_denied','Candidato não desativa terceiros');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000123","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.list_portal_accounts()$$,'42501','permission_denied','Administrador delegado não administra contas');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000122","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select throws_ok($$select public.list_portal_accounts()$$,'42501','permission_denied','Principal precisa de MFA');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000122","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select is((select count(*)::integer from public.list_portal_accounts('portal-',null,1)),2,'Lista contas com e sem currículo, exclui equipe');
select is((select count(*)::integer from public.list_portal_accounts('portal-empty',null,1) where candidate_id is null and confirmed_at is null),1,'Conta não confirmada é administrável');
select is((select count(*)::integer from public.list_portal_accounts($$'); DROP TABLE public.candidates; --$$,null,1)),0,'Busca trata SQL como valor literal');
select throws_ok($$select public.set_portal_account_access('00000000-0000-4000-8000-000000000123',false,'Teste')$$,'P0001','invalid_portal_account','Equipe não é alvo de moderação de candidatos');
select throws_ok($$select public.set_portal_account_access('00000000-0000-4000-8000-000000000121',false,'')$$,'P0001','account_reason_required','Motivo obrigatório');
select lives_ok($$select public.set_portal_account_access('00000000-0000-4000-8000-000000000121',false,'Abuso fictício de teste')$$,'Principal desativa conta');
select is((select active from public.list_portal_accounts('portal-owner',false,1)),false,'Filtro mostra desativação');
select ok(exists(select 1 from public.candidates where id='00000000-0000-4000-8000-000000000126' and talent_pool),'Currículo e escolha são preservados');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000121","role":"authenticated","session_id":"00000000-0000-4000-8000-000000000125","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select ok(not public.portal_session_allowed(),'JWT anterior bloqueado imediatamente');
select is((select count(*)::integer from public.candidates),0,'RLS oculta currículo da conta desativada');
select is((select count(*)::integer from public.notifications),0,'RLS oculta notificações');
select throws_ok($$select public.save_candidate('{}')$$,'42501','portal_access_disabled','RPC direta não salva currículo');
select throws_ok($$select public.save_privacy('00000000-0000-4000-8000-000000000127',true)$$,'42501','portal_access_disabled','RPC direta não muda consentimento');
select throws_ok($$select public.submit_application('00000000-0000-4000-8000-000000000127','{}','00000000-0000-4000-8000-000000000127')$$,'42501','portal_access_disabled','RPC direta não candidata');
select throws_ok($$select public.export_my_data()$$,'42501','portal_access_disabled','Exportação direta bloqueada');
select throws_ok($$select public.my_registration()$$,'42501','portal_access_disabled','Identificação privada bloqueada');
select throws_ok($$select public.update_account_name('Outro nome')$$,'42501','portal_access_disabled','Conta desativada não muda cadastro');
select throws_ok($$select public.authorize_curriculum_export('00000000-0000-4000-8000-000000000126')$$,'42501','portal_access_disabled','PDF direto bloqueado');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000122","role":"authenticated","aal":"aal2","app_metadata":{"provider":"email"}}',true);
select lives_ok($$select public.set_portal_account_access('00000000-0000-4000-8000-000000000121',true,'Revisão fictícia concluída')$$,'Principal reativa conta');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000121","role":"authenticated","session_id":"00000000-0000-4000-8000-000000000125","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select ok(not public.portal_session_allowed(),'Reativar não restaura sessões anteriores');
reset role;
insert into auth.sessions(id,user_id,created_at,updated_at) values('00000000-0000-4000-8000-000000000128','00000000-0000-4000-8000-000000000121',clock_timestamp()+interval '1 second',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000121","role":"authenticated","session_id":"00000000-0000-4000-8000-000000000128","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select ok(public.portal_session_allowed(),'Novo login autorizado depois da reativação');
select is((select count(*)::integer from public.candidates),1,'Currículo preservado acessível no novo login');
reset role;
select is((select count(*)::integer from public.audit_events where resource='portal_account_access' and resource_id='00000000-0000-4000-8000-000000000121'),2,'Desativação e reativação auditadas');
select * from finish();
rollback;
