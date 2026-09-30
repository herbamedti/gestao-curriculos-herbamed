begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select plan(8);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
('00000000-0000-4000-8000-000000000001','rls.alice@example.test',now(),'{}'),
('00000000-0000-4000-8000-000000000002','rls.bob@example.test',now(),'{}');
insert into public.candidates(user_id,full_name,email,city) values
('00000000-0000-4000-8000-000000000001','Alice de Teste','rls.alice@example.test','Cidade A'),
('00000000-0000-4000-8000-000000000002','Bob de Teste','rls.bob@example.test','Cidade B');
insert into public.staff(user_id,display_name) values ('00000000-0000-4000-8000-000000000002','Bob RH');
insert into public.staff_roles(user_id,role_id) select '00000000-0000-4000-8000-000000000002',id from public.roles where name='Administrador RH';
do $$ begin
 if to_regclass('storage.objects') is not null then
  insert into storage.objects(bucket_id,name) values ('quarantine','rls/private-test.pdf');
 end if;
end $$;
create function pg_temp.quarantine_is_hidden() returns boolean language plpgsql as $$
declare visible_count integer;
begin
 if to_regclass('storage.objects') is null then return true; end if;
 execute 'select count(*) from storage.objects where bucket_id=''quarantine''' into visible_count;
 return visible_count=0;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","app_metadata":{"provider":"email"}}',true);
select is((select count(*)::integer from public.candidates where email='rls.alice@example.test'),1,'Candidata lê o próprio perfil');
select is((select count(*)::integer from public.candidates where email='rls.bob@example.test'),0,'Candidata não lê perfil alheio');
select ok(not public.is_staff(),'Candidata não tem acesso RH');
select ok(not has_table_privilege('authenticated','public.candidates','UPDATE'),'Escrita direta em candidatos negada');
select ok(not has_table_privilege('authenticated','public.applications','INSERT'),'Candidatura direta negada: usar RPC');
select ok(pg_temp.quarantine_is_hidden(),'Storage em quarentena sem leitura direta, ou desativado');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","app_metadata":{"provider":"azure"}}',true);
select ok(not public.has_permission('candidates.read'),'RH sem MFA é bloqueado');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","app_metadata":{"provider":"azure"}}',true);
select ok(public.has_permission('candidates.read'),'RH com perfil e MFA autorizado');
reset role;
select * from finish();
rollback;
