begin;
create extension if not exists pgtap with schema extensions;
set search_path to public,extensions;
select no_plan();

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000131','policy-manager@example.test',now(),'{"provider":"azure"}'),
 ('00000000-0000-4000-8000-000000000132','policy-reader@example.test',now(),'{}');
insert into public.staff(user_id,display_name) values ('00000000-0000-4000-8000-000000000131','Gestor fictício');
insert into public.staff_roles select '00000000-0000-4000-8000-000000000131',id from public.roles where name='Superadministrador';
insert into public.candidates(id,user_id,full_name,email) values
 ('00000000-0000-4000-8000-000000000133','00000000-0000-4000-8000-000000000132','Pessoa fictícia','policy-reader@example.test');

select ok((select relrowsecurity from pg_class where oid='public.privacy_policies'::regclass),'Avisos continuam com RLS');
select ok(not has_table_privilege('authenticated','public.privacy_policies','UPDATE'),'Edição direta continua proibida');
select ok(not has_table_privilege('authenticated','public.privacy_policies','DELETE'),'Exclusão direta continua proibida');
select ok(not has_function_privilege('anon','public.publish_privacy_policy(text,text,text)','EXECUTE'),'Visitante não publica');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000131","role":"authenticated","aal":"aal1","app_metadata":{"provider":"azure"}}',true);
select throws_ok($$select public.publish_privacy_policy('teste-v1','Aviso fictício',repeat('a',30000))$$,'42501','permission_denied','MFA continua obrigatório');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000131","role":"authenticated","aal":"aal2","app_metadata":{"provider":"azure"}}',true);
select lives_ok($$select public.publish_privacy_policy('teste-v1','Aviso fictício',repeat('a',30000))$$,'Publicação aceita texto acima de ambos os limites anteriores');
select is((select char_length(body) from public.privacy_policies where version='teste-v1'),30000,'Texto longo é salvo integralmente');
reset role;
insert into public.policy_acknowledgements(candidate_id,policy_id,purpose,granted)
 select '00000000-0000-4000-8000-000000000133',id,'notice',true from public.privacy_policies where version='teste-v1';
set local role authenticated;
select lives_ok($$select public.publish_privacy_policy('teste-v2','Aviso revisado fictício',repeat('b',100000))$$,'Limite de 100 mil caracteres aceito');
select is((select count(*)::int from public.privacy_policies where active),1,'Uma única versão vigente');
select is((select version from public.privacy_policies where active),'teste-v2','Nova versão fica vigente');
select is((select body from public.privacy_policies where version='teste-v1'),repeat('a',30000),'Texto anterior permanece intacto');
select is((select active from public.privacy_policies where version='teste-v1'),false,'Versão anterior é desativada');
reset role;
select is((select p.version from public.policy_acknowledgements a join public.privacy_policies p on p.id=a.policy_id where a.candidate_id='00000000-0000-4000-8000-000000000133'),'teste-v1','Ciência mantém vínculo com a versão anterior');
set local role authenticated;
select throws_ok($$select public.publish_privacy_policy(' teste-v2 ','Título duplicado',repeat('c',200))$$,'P0001','policy_version_exists','Versão repetida tem erro específico');
select throws_ok($$select public.publish_privacy_policy('teste-v3','Aviso excessivo',repeat('c',100001))$$,'P0001','invalid_policy_content','Texto excessivo rejeitado');
select throws_ok($$select public.publish_privacy_policy('teste-v3','Aviso curto',repeat('c',99))$$,'P0001','invalid_policy_content','Texto curto rejeitado');
select throws_ok($$select public.publish_privacy_policy('teste-v3','Aviso nulo',null)$$,'P0001','invalid_policy_content','Texto nulo rejeitado');
select is((select char_length(body) from public.privacy_policies where active),100000,'Falhas preservam texto vigente');
select is((select version from public.privacy_policies where active),'teste-v2','Falhas preservam versão vigente');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000132","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.publish_privacy_policy('teste-v3','Aviso indevido',repeat('c',200))$$,'42501','permission_denied','Candidato com AAL2 não publica');
select is((select count(*)::int from public.privacy_policies where version in ('teste-v1','teste-v2')),2,'Leitura permite consultar histórico publicado');
select * from finish();
rollback;
