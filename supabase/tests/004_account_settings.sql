begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(17);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000071','account.candidate@example.test',now(),'{}'),
 ('00000000-0000-4000-8000-000000000072','account.staff@example.test',now(),'{}');
insert into public.candidates(user_id,full_name,email) values
 ('00000000-0000-4000-8000-000000000071','Candidata Inicial','account.candidate@example.test');
insert into public.staff(user_id,display_name) values
 ('00000000-0000-4000-8000-000000000072','Gestor Inicial');
insert into public.staff_roles(user_id,role_id)
 select '00000000-0000-4000-8000-000000000072',id from public.roles where name='Administrador RH';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000072","role":"authenticated","aal":"aal1","app_metadata":{"provider":"azure"}}',true);
select ok((select mfa_enabled from public.staff where user_id=auth.uid()),'MFA ligado por padrão');
select ok(not public.has_permission('candidates.read'),'AAL1 bloqueia RH inicialmente');
select ok(not has_table_privilege('authenticated','public.staff','UPDATE'),'Escrita direta de staff negada');
select ok(public.set_account_mfa(true),'Ativar MFA é permitido sem reduzir proteção');
select ok(not public.set_account_mfa(false),'Desativar sem prova é negado');
select ok(not public.has_permission('candidates.read'),'Negação mantém permissão bloqueada');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000072","role":"authenticated","aal":"aal2","app_metadata":{"provider":"azure"}}',true);
select ok(public.set_account_mfa(false),'Sessão AAL2 pode desativar');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000072","role":"authenticated","aal":"aal1","app_metadata":{"provider":"azure"}}',true);
select ok(public.has_permission('candidates.read'),'Preferência individual libera RH no AAL1');
select ok(public.set_account_mfa(true),'Reativação funciona');
select ok(not public.has_permission('candidates.read'),'Reativação volta a exigir AAL2');

reset role;
insert into private.account_email_challenges(user_id,code_hash,expires_at,recipient_email)
values('00000000-0000-4000-8000-000000000072',encode(extensions.digest('A1B2C3D4E5','sha256'),'hex'),now()+interval '10 minutes','account.staff@example.test');
set local role authenticated;
select ok(not public.set_account_mfa(false,'0000000000'),'Código incorreto não desativa');
select ok(public.set_account_mfa(false,'A1B2C3D4E5'),'Código enviado ao e-mail desativa');
select public.update_account_name('Gestora Atualizada');
select is((select display_name from public.staff where user_id=auth.uid()),'Gestora Atualizada','Nome próprio atualizado por RPC');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000071","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select ok(not public.is_staff(),'Candidata permanece fora do RH');
select ok(not has_function_privilege('anon','public.set_account_mfa(boolean,text)','EXECUTE'),'Anônimo não pode alternar MFA');
reset role;
insert into private.account_email_challenges(user_id,code_hash,expires_at,recipient_email)
values('00000000-0000-4000-8000-000000000071',encode(extensions.digest('B1B2C3D4E5','sha256'),'hex'),now()+interval '10 minutes','account.candidate@example.test');
update auth.users set email='account.changed@example.test' where id='00000000-0000-4000-8000-000000000071';
set local role authenticated;
select is((select email from public.candidates where user_id=auth.uid()),'account.changed@example.test','E-mail confirmado sincroniza currículo');
select ok(not public.consume_account_email_code('B1B2C3D4E5'),'Código antigo inválido após troca de e-mail');
select * from finish();
rollback;
