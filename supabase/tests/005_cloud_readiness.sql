begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(12);

select ok(has_function_privilege('service_role','public.issue_account_email_code(uuid)','EXECUTE'),'Somente servidor pode emitir código');
select ok(not has_function_privilege('authenticated','public.issue_account_email_code(uuid)','EXECUTE'),'Pessoa autenticada não pode emitir código diretamente');
select ok(not has_function_privilege('anon','public.revoke_account_email_code(uuid,text)','EXECUTE'),'Anônimo não pode revogar código');
select ok(not has_function_privilege('service_role','private.bootstrap_first_staff(text,text)','EXECUTE'),'Bootstrap fora da Data API');

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000081','cloud.candidate@example.test',now(),'{}'),
 ('00000000-0000-4000-8000-000000000082','cloud.staff@example.test',now(),'{"provider":"azure"}');
insert into public.staff(user_id,display_name) values
 ('00000000-0000-4000-8000-000000000082','Gestora Cloud');
insert into public.staff_roles(user_id,role_id)
 select '00000000-0000-4000-8000-000000000082',id from public.roles where name='Superadministrador';

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.issue_account_email_code('00000000-0000-4000-8000-000000000081')$$,'RPC de emissão executa com service_role');
reset role;
select is((select count(*)::int from private.account_email_challenges where user_id='00000000-0000-4000-8000-000000000081'),1,'Código fica na tabela privada');
select is((select length(code_hash) from private.account_email_challenges where user_id='00000000-0000-4000-8000-000000000081'),64,'Somente hash SHA-256 fica armazenado');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000082","role":"authenticated","aal":"aal1","app_metadata":{"provider":"azure"}}',true);
select throws_ok($$select public.publish_privacy_policy('v2','Aviso aprovado',repeat('Texto aprovado. ',10))$$,'42501','permission_denied','AAL1 não publica aviso');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000082","role":"authenticated","aal":"aal2","app_metadata":{"provider":"azure"}}',true);
select lives_ok($$select public.publish_privacy_policy('v2','Aviso aprovado',repeat('Texto aprovado. ',10))$$,'RH com AAL2 publica aviso');
select is((select count(*)::int from public.privacy_policies where active),1,'Somente um aviso fica ativo');
select is((select version from public.privacy_policies where active),'v2','Versão aprovada está ativa');
select ok(not has_function_privilege('anon','public.publish_privacy_policy(text,text,text)','EXECUTE'),'Anônimo não publica aviso');
select * from finish();
rollback;
