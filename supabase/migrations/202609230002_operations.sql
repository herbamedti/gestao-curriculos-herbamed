create function public.add_evaluation(p_application_id uuid,p_kind text,p_body text,p_criteria text default '',p_recommendation text default '') returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.can_application(p_application_id,'evaluations.create') then raise exception 'permission_denied' using errcode='42501'; end if;
 insert into public.evaluations(application_id,author_id,kind,body,criteria,recommendation) values(p_application_id,auth.uid(),p_kind,p_body,p_criteria,p_recommendation);
end $$;
create function public.schedule_interview(p_application_id uuid,p_starts_at timestamptz,p_location text,p_duration integer default 30) returns void language plpgsql security definer set search_path='' as $$ declare uid uuid; begin
 if not public.can_application(p_application_id,'interviews.manage') then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_starts_at<now() then raise exception 'past_interview'; end if;
 insert into public.interviews(application_id,interviewer_id,starts_at,location,duration_minutes) values(p_application_id,auth.uid(),p_starts_at,p_location,p_duration);
 select c.user_id into uid from public.applications a join public.candidates c on c.id=a.candidate_id where a.id=p_application_id;
 perform private.notify(uid,'Entrevista agendada','Confira data e local da sua entrevista no portal.');
end $$;
create function public.send_message(p_candidate_id uuid,p_subject text,p_body text) returns void language plpgsql security definer set search_path='' as $$ declare uid uuid; begin
 if not public.can_candidate(p_candidate_id,'messages.send') and not public.owns_candidate(p_candidate_id) then raise exception 'permission_denied' using errcode='42501'; end if;
 perform private.rate_limit('message',30);
 insert into public.messages(candidate_id,sender_id,subject,body) values(p_candidate_id,auth.uid(),p_subject,p_body);
 select user_id into uid from public.candidates where id=p_candidate_id;
 if uid<>auth.uid() then perform private.notify(uid,'Nova mensagem da Herbamed','Você recebeu uma mensagem. Acesse sua área no portal.'); end if;
end $$;
create function public.request_privacy(p_kind text,p_detail text default '') returns uuid language plpgsql security definer set search_path='' as $$ declare cid uuid; rid uuid; begin
 perform private.rate_limit('privacy',5);
 select id into cid from public.candidates where user_id=auth.uid();
 insert into public.privacy_requests(candidate_id,kind,detail) values(cid,p_kind,left(p_detail,4000)) returning id into rid;
 if p_kind='revocation' then update public.candidates set talent_pool=false where id=cid; end if;
 return rid;
end $$;
create function public.resolve_privacy(p_id uuid,p_status text,p_resolution text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('privacy.manage');
 if length(trim(p_resolution))<10 then raise exception 'resolution_required'; end if;
 update public.privacy_requests set status=p_status,resolution=p_resolution,assigned_to=auth.uid(),resolved_at=case when p_status in ('completed','denied') then now() else null end where id=p_id;
end $$;
create function public.mark_notification(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin update public.notifications set read_at=now() where id=p_id and user_id=auth.uid(); end $$;
create function public.register_document(p_candidate_id uuid,p_name text,p_size integer,p_kind text) returns public.documents language plpgsql security definer set search_path='' as $$ declare doc public.documents; begin
 if not public.owns_candidate(p_candidate_id) and not public.can_candidate(p_candidate_id,'candidates.edit') then raise exception 'permission_denied' using errcode='42501'; end if;
 perform private.rate_limit('upload',15);
 insert into public.documents(candidate_id,original_name,size_bytes,kind,mime,object_path)
 values(p_candidate_id,left(p_name,255),p_size,p_kind,case when p_kind='resume' then 'application/pdf' else 'image/jpeg' end,p_candidate_id::text || '/' || gen_random_uuid()::text || case when p_kind='resume' then '.pdf' else '.jpg' end) returning * into doc;
 return doc;
end $$;
create function public.authorize_download(p_document_id uuid) returns text language plpgsql security definer set search_path='' as $$ declare doc public.documents; begin
 select * into doc from public.documents where id=p_document_id;
 if doc.id is null or doc.status<>'clean' or (not public.owns_candidate(doc.candidate_id) and not public.can_candidate(doc.candidate_id,'documents.download')) then raise exception 'permission_denied' using errcode='42501'; end if;
 insert into public.audit_events(actor_id,action,resource,resource_id) values(auth.uid(),'download','documents',doc.id::text);
 return doc.object_path;
end $$;
create function public.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$ declare cid uuid; result jsonb; begin
 perform private.rate_limit('export_self',5);
 select id into cid from public.candidates where user_id=auth.uid();
 if cid is null then raise exception 'profile_required'; end if;
 select jsonb_build_object('profile',to_jsonb(c)-'search_document','entries',(select coalesce(jsonb_agg(e),'[]') from public.profile_entries e where e.candidate_id=cid),'applications',(select coalesce(jsonb_agg(a),'[]') from public.applications a where a.candidate_id=cid),'messages',(select coalesce(jsonb_agg(m),'[]') from public.messages m where m.candidate_id=cid),'privacy',(select coalesce(jsonb_agg(p),'[]') from public.policy_acknowledgements p where p.candidate_id=cid),'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.original_name,'status',d.status)),'[]') from public.documents d where d.candidate_id=cid)) into result from public.candidates c where c.id=cid;
 insert into public.audit_events(actor_id,action,resource,resource_id) values(auth.uid(),'export_self','candidates',cid::text);
 return result;
end $$;
create function public.export_candidates() returns table(id uuid,full_name text,city text,headline text,created_at timestamptz) language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('candidates.export');
 perform private.require_permission('candidates.read');
 insert into public.audit_events(actor_id,action,resource) values(auth.uid(),'export','candidates');
 return query select c.id,c.full_name,c.city,c.headline,c.created_at from public.candidates c where c.archived_at is null order by c.created_at desc limit 5000;
end $$;

create function public.manage_catalog(p_catalog text,p_name text,p_id uuid default null,p_active boolean default true) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('settings.manage');
 if p_catalog not in ('departments','interest_areas','tags','talent_pools') then raise exception 'invalid_catalog'; end if;
 if length(p_name) not between 2 and 100 then raise exception 'invalid_name'; end if;
 if p_id is null then execute format('insert into public.%I(name,active) values($1,$2)',p_catalog) using p_name,p_active;
 else execute format('update public.%I set name=$1,active=$2 where id=$3',p_catalog) using p_name,p_active,p_id; end if;
end $$;
create function public.manage_role(p_name text,p_scope text,p_mfa boolean,p_permissions text[],p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$ declare rid uuid; begin
 perform private.require_permission('roles.manage');
 -- Privilege changes are serialized; editing one's own role is prohibited.
 perform pg_advisory_xact_lock(726349);
 if exists(select 1 from public.staff_roles where user_id=auth.uid() and role_id=p_id) then raise exception 'cannot_change_own_role'; end if;
 if p_id is null then insert into public.roles(name,scope,require_mfa) values(p_name,p_scope,p_mfa) returning id into rid;
 else rid=p_id; update public.roles set name=p_name,scope=p_scope,require_mfa=p_mfa where id=rid; end if;
 delete from public.role_permissions where role_id=rid;
 insert into public.role_permissions(role_id,permission) select rid,unnest(p_permissions);
 return rid;
end $$;
create function public.manage_staff(p_email text,p_name text,p_role_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$ declare uid uuid; begin
 perform private.require_permission('users.manage');
 perform private.require_permission('roles.manage');
 perform pg_advisory_xact_lock(726349);
 select id into uid from auth.users where lower(email)=lower(p_email) and email_confirmed_at is not null;
 if uid is null then raise exception 'user_must_sign_in_first'; end if;
 if uid=auth.uid() then raise exception 'cannot_change_self'; end if;
 insert into public.staff(user_id,display_name,active) values(uid,p_name,p_active) on conflict(user_id) do update set display_name=excluded.display_name,active=excluded.active;
 delete from public.staff_roles where user_id=uid;
 insert into public.staff_roles(user_id,role_id) values(uid,p_role_id);
end $$;
create function public.update_setting(p_key text,p_value jsonb) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('settings.manage');
 if p_key='max_interest_areas' then
 if jsonb_typeof(p_value)<>'number' or p_value::text::integer not between 1 and 10 then raise exception 'invalid_value'; end if;
 elsif p_key='app_name' then if jsonb_typeof(p_value)<>'string' or length(p_value::text)>100 then raise exception 'invalid_value'; end if;
 elsif p_key='retention' then perform private.require_permission('privacy.manage');
 else raise exception 'invalid_key'; end if;
 update public.settings set value=p_value where key=p_key;
end $$;

insert into public.permissions(code,label) values
 ('dashboard.read','Visualizar dashboard'),('jobs.read','Visualizar vagas internas'),('jobs.manage','Criar e editar vagas'),('jobs.publish','Publicar e encerrar vagas'),
 ('candidates.read','Visualizar candidatos'),('candidates.create','Cadastrar candidatos'),('candidates.edit','Editar candidatos'),('candidates.export','Exportar candidatos'),
 ('documents.read','Visualizar metadados dos documentos'),('documents.download','Baixar currículos'),('applications.read','Visualizar candidaturas'),('applications.move','Movimentar candidaturas'),
 ('evaluations.read','Visualizar avaliações'),('evaluations.create','Avaliar candidatos'),('interviews.read','Visualizar entrevistas'),('interviews.manage','Agendar entrevistas'),
 ('messages.read','Visualizar mensagens'),('messages.send','Enviar mensagens'),('users.manage','Gerenciar usuários'),('roles.manage','Gerenciar perfis e permissões'),
 ('settings.manage','Gerenciar configurações'),('privacy.manage','Gerenciar privacidade'),('audit.read','Visualizar auditoria'),('reports.read','Visualizar relatórios');
insert into public.roles(name,scope,require_mfa) values ('Superadministrador','all',true),('Administrador TI','all',true),('Administrador RH','all',true),('Recrutador','all',true),('Gestor da vaga','assigned',true),('Entrevistador','assigned',true),('Auditoria','all',true);
insert into public.role_permissions select r.id,p.code from public.roles r cross join public.permissions p where r.name='Superadministrador';
insert into public.role_permissions select r.id,p.code from public.roles r cross join public.permissions p where r.name='Administrador TI' and p.code in ('users.manage','roles.manage','settings.manage','audit.read');
insert into public.role_permissions select r.id,p.code from public.roles r cross join public.permissions p where r.name in ('Administrador RH','Recrutador') and p.code not in ('users.manage','roles.manage','settings.manage','privacy.manage','audit.read','candidates.export');
insert into public.role_permissions select r.id,p.code from public.roles r cross join public.permissions p where r.name='Administrador RH' and p.code in ('privacy.manage','candidates.export');
insert into public.role_permissions select r.id,p.code from public.roles r cross join public.permissions p where r.name in ('Gestor da vaga','Entrevistador') and p.code in ('jobs.read','candidates.read','documents.read','documents.download','applications.read','evaluations.read','evaluations.create','interviews.read');
insert into public.role_permissions select r.id,p.code from public.roles r cross join public.permissions p where r.name='Auditoria' and p.code in ('audit.read','reports.read');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('quarantine','quarantine',false,5242880,array['application/pdf','image/jpeg']),('documents','documents',false,5242880,array['application/pdf','image/jpeg']);
-- Authenticated user can insert only an already registered object, never overwrite or read quarantine.
create policy quarantine_insert on storage.objects for insert to authenticated with check(bucket_id='quarantine' and exists(select 1 from public.documents d where d.object_path=name and d.status='pending' and (public.owns_candidate(d.candidate_id) or public.can_candidate(d.candidate_id,'candidates.edit'))));
-- Signed links are issued by a small authenticated gateway; no permanent direct read permission.
-- Worker/gateway use narrow SECURITY DEFINER RPC, storage signing uses server-only worker credentials.

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function public.has_permission(text,uuid),public.is_staff(),public.owns_candidate(uuid),public.can_candidate(uuid,text),public.can_application(uuid,text),public.owns_application(uuid) to anon,authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_candidate','create_manual_candidate','save_profile_entry','save_privacy','save_job','set_job_status','add_job_item','submit_application','move_application','withdraw_application','add_evaluation','schedule_interview','send_message','request_privacy','resolve_privacy','mark_notification','register_document','authorize_download','export_my_data','export_candidates','manage_catalog','manage_role','manage_staff','update_setting') loop
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
