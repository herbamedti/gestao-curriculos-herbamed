create extension if not exists pg_trgm with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

create table private.security_config (singleton boolean primary key default true check(singleton), allow_local_password_staff boolean not null default false);
insert into private.security_config default values;

create table public.roles (id uuid primary key default gen_random_uuid(), name text not null unique, require_mfa boolean not null default true, scope text not null default 'assigned' check(scope in ('all','assigned')), active boolean not null default true);
create table public.permissions (code text primary key, label text not null);
create table public.role_permissions (role_id uuid references public.roles on delete cascade, permission text references public.permissions on delete cascade, primary key(role_id,permission));
create table public.staff (user_id uuid primary key references auth.users on delete cascade, display_name text not null, active boolean not null default true, created_at timestamptz not null default now());
create table public.staff_roles (user_id uuid references public.staff on delete cascade, role_id uuid references public.roles on delete cascade, primary key(user_id,role_id));
create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true);
create table public.interest_areas (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true);
create table public.settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
insert into public.settings values ('app_name','"Herbamed Carreiras"',now()),('max_interest_areas','3',now()),('retention','{"approved":false,"talent_days":null,"document_days":null,"audit_days":null}',now());

create table public.candidates (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users on delete set null,
 full_name text not null check(char_length(full_name) between 2 and 160), email text not null,
 phone text not null default '', city text not null default '', state text not null default '', headline text not null default '', summary text not null default '',
 skills text[] not null default '{}', availability text not null default '', work_model text not null default '', professional_url text not null default '',
 source text not null default 'portal', processing_purpose text not null default 'recrutamento', legal_basis text,
 created_by uuid references auth.users on delete set null, talent_pool boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 search_document tsvector generated always as (to_tsvector('portuguese',coalesce(full_name,'') || ' ' || coalesce(headline,'') || ' ' || coalesce(city,'') || ' ' || coalesce(summary,''))) stored
);
create unique index candidates_email_unique on public.candidates(lower(email));
create index candidates_search on public.candidates using gin(search_document);
create index candidates_name_trgm on public.candidates using gin(full_name extensions.gin_trgm_ops);
create index candidates_city_active on public.candidates(city,created_at desc) where archived_at is null;
create table public.candidate_interests (candidate_id uuid references public.candidates on delete cascade, area_id uuid references public.interest_areas, primary key(candidate_id,area_id));
create table public.profile_entries (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates on delete cascade,
 kind text not null check(kind in ('experience','education','course','certification','language')), title text not null, organization text not null default '',
 start_date date, end_date date, description text not null default '', created_at timestamptz not null default now(), check(end_date is null or start_date is null or end_date >= start_date)
);
create index profile_entries_candidate on public.profile_entries(candidate_id,kind);
create table public.jobs (
 id uuid primary key default gen_random_uuid(), code bigint generated always as identity unique,
 slug text not null unique, title text not null check(char_length(title) between 3 and 160), department_id uuid references public.departments,
 city text not null, state text not null default '', work_model text not null check(work_model in ('Presencial','Híbrido','Remoto')),
 contract_type text not null default 'CLT', description text not null, responsibilities text not null default '', requirements text not null default '', benefits text not null default '',
 openings integer not null default 1 check(openings > 0), status text not null default 'draft' check(status in ('draft','pending','published','paused','closed','cancelled','archived')),
 visibility text not null default 'public' check(visibility in ('public','internal')), deadline timestamptz, published_at timestamptz,
 created_by uuid references auth.users on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index jobs_public on public.jobs(published_at desc) where status='published' and visibility='public';
create table public.job_assignments (job_id uuid references public.jobs on delete cascade, user_id uuid references public.staff on delete cascade, primary key(job_id,user_id));
create table public.job_stages (id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs on delete cascade, name text not null, position integer not null check(position>=0), terminal boolean not null default false, unique(job_id,position), unique(job_id,id));
create table public.job_questions (id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs on delete cascade, label text not null, required boolean not null default false, position integer not null default 0, unique(job_id,id));
create table public.documents (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates on delete cascade,
 kind text not null check(kind in ('resume','photo')), original_name text not null, object_path text not null unique, mime text not null, size_bytes integer not null check(size_bytes between 1 and 5242880),
 status text not null default 'pending' check(status in ('pending','scanning','clean','rejected','error')), sha256 text, scan_message text, scanned_at timestamptz,
 created_at timestamptz not null default now()
);
create index documents_pending on public.documents(created_at) where status in ('pending','error');
create index documents_candidate on public.documents(candidate_id,created_at desc);
create table public.privacy_policies (id uuid primary key default gen_random_uuid(), version text not null unique, title text not null, body text not null, published_at timestamptz, active boolean not null default false);
create unique index policy_single_active on public.privacy_policies(active) where active;
create table public.policy_acknowledgements (id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates on delete cascade, policy_id uuid not null references public.privacy_policies, purpose text not null check(purpose in ('notice','talent_pool')), granted boolean not null, created_at timestamptz not null default now());
create table public.applications (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates, job_id uuid not null references public.jobs,
 stage_id uuid not null, resume_id uuid references public.documents, status text not null default 'active' check(status in ('active','withdrawn','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(candidate_id,job_id),
 foreign key(job_id,stage_id) references public.job_stages(job_id,id)
);
create index applications_job_stage on public.applications(job_id,stage_id,created_at desc);
create index applications_candidate on public.applications(candidate_id,created_at desc);
create table public.application_answers (application_id uuid references public.applications on delete cascade, question_id uuid references public.job_questions, answer text not null check(char_length(answer)<=4000), primary key(application_id,question_id));
create table public.application_events (id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications, from_stage uuid references public.job_stages, to_stage uuid references public.job_stages, actor_id uuid references auth.users on delete set null, note text not null default '', created_at timestamptz not null default now());
create table public.evaluations (id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications, author_id uuid not null references public.staff, kind text not null check(kind in ('note','evaluation')), criteria text not null default '', body text not null check(char_length(body) between 1 and 10000), recommendation text not null default '', created_at timestamptz not null default now());
create table public.interviews (id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications, interviewer_id uuid not null references public.staff, starts_at timestamptz not null, duration_minutes integer not null default 30 check(duration_minutes between 10 and 480), location text not null, mode text not null default 'online', notes text not null default '', status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')), created_at timestamptz not null default now());
create table public.messages (id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates, sender_id uuid not null references auth.users, subject text not null, body text not null check(char_length(body) between 1 and 10000), created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now());
create table public.message_templates (id uuid primary key default gen_random_uuid(), name text not null unique, subject text not null, body text not null, active boolean not null default true);
create table public.tags (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true);
create table public.candidate_tags (candidate_id uuid references public.candidates on delete cascade, tag_id uuid references public.tags, primary key(candidate_id,tag_id));
create table public.talent_pools (id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', active boolean not null default true);
create table public.pool_members (pool_id uuid references public.talent_pools on delete cascade, candidate_id uuid references public.candidates on delete cascade, primary key(pool_id,candidate_id));
create table public.privacy_requests (id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates, kind text not null check(kind in ('access','correction','deletion','portability','revocation','information')), detail text not null default '', status text not null default 'open' check(status in ('open','reviewing','completed','denied')), assigned_to uuid references public.staff, due_at timestamptz, resolution text, created_at timestamptz not null default now(), resolved_at timestamptz);
create table public.audit_events (id bigint generated always as identity primary key, actor_id uuid, action text not null, resource text not null, resource_id text, created_at timestamptz not null default now());
create index audit_recent on public.audit_events(created_at desc);
create table private.outbox (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users, subject text not null, body text not null, status text not null default 'pending' check(status in ('pending','sending','sent','failed')), attempts integer not null default 0, next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now());
create table private.rate_limits (user_id uuid, action text, bucket timestamptz, count integer not null default 1, primary key(user_id,action,bucket));

create function public.has_permission(p_permission text, p_job_id uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff s join public.staff_roles sr on sr.user_id=s.user_id join public.roles r on r.id=sr.role_id join public.role_permissions rp on rp.role_id=r.id
 where s.user_id=auth.uid() and s.active and r.active and rp.permission=p_permission
 and (auth.jwt()->'app_metadata'->>'provider'='azure' or (select allow_local_password_staff from private.security_config where singleton))
 and (not r.require_mfa or auth.jwt()->>'aal'='aal2')
 and (r.scope='all' or (p_job_id is not null and exists(select 1 from public.job_assignments ja where ja.job_id=p_job_id and ja.user_id=s.user_id))))
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff where user_id=auth.uid() and active)
 and (auth.jwt()->'app_metadata'->>'provider'='azure' or (select allow_local_password_staff from private.security_config where singleton))
$$;
create function public.owns_candidate(p_candidate_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.candidates where id=p_candidate_id and user_id=auth.uid() and archived_at is null) $$;
create function public.can_candidate(p_candidate_id uuid,p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_permission(p_permission) or exists(select 1 from public.applications a where a.candidate_id=p_candidate_id and public.has_permission(p_permission,a.job_id))
$$;
create function public.can_application(p_application_id uuid,p_permission text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.applications a where a.id=p_application_id and public.has_permission(p_permission,a.job_id)) $$;
create function public.owns_application(p_application_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.applications a join public.candidates c on c.id=a.candidate_id where a.id=p_application_id and c.user_id=auth.uid()) $$;
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.audit_events(actor_id,action,resource,resource_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(NEW)->>'key',to_jsonb(NEW)->>'user_id',to_jsonb(OLD)->>'id'));
 if TG_OP='DELETE' then return OLD; end if; return NEW; end $$;
create function private.touch() returns trigger language plpgsql set search_path='' as $$ begin NEW.updated_at=now(); return NEW; end $$;

do $$ declare t text; begin
 foreach t in array array['roles','permissions','role_permissions','staff','staff_roles','departments','interest_areas','settings','candidates','candidate_interests','profile_entries','jobs','job_assignments','job_stages','job_questions','documents','privacy_policies','policy_acknowledgements','applications','application_answers','application_events','evaluations','interviews','messages','notifications','message_templates','tags','candidate_tags','talent_pools','pool_members','privacy_requests','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t <> 'audit_events' then execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t); end if;
 end loop;
 foreach t in array array['candidates','jobs','applications','settings'] loop execute format('create trigger touch before update on public.%I for each row execute function private.touch()',t); end loop;
end $$;
grant select on public.jobs,public.departments,public.interest_areas,public.job_stages,public.job_questions,public.privacy_policies to anon;

create policy candidate_read on public.candidates for select to authenticated using(public.owns_candidate(id) or public.can_candidate(id,'candidates.read'));
create policy profile_read on public.profile_entries for select to authenticated using(public.owns_candidate(candidate_id) or public.can_candidate(candidate_id,'candidates.read'));
create policy interests_read on public.candidate_interests for select to authenticated using(public.owns_candidate(candidate_id) or public.can_candidate(candidate_id,'candidates.read'));
create policy jobs_read on public.jobs for select using((status='published' and visibility='public') or public.has_permission('jobs.read',id) or exists(select 1 from public.applications a where a.job_id=id and public.owns_candidate(a.candidate_id)));
create policy stages_read on public.job_stages for select using(exists(select 1 from public.jobs j where j.id=job_id));
create policy questions_read on public.job_questions for select using(exists(select 1 from public.jobs j where j.id=job_id));
create policy application_read on public.applications for select to authenticated using(public.owns_candidate(candidate_id) or public.has_permission('applications.read',job_id));
create policy answers_read on public.application_answers for select to authenticated using(public.owns_application(application_id) or public.can_application(application_id,'applications.read'));
create policy events_read on public.application_events for select to authenticated using(public.owns_application(application_id) or public.can_application(application_id,'applications.read'));
create policy evaluation_read on public.evaluations for select to authenticated using(public.can_application(application_id,'evaluations.read'));
create policy interview_read on public.interviews for select to authenticated using(public.owns_application(application_id) or public.can_application(application_id,'interviews.read'));
create policy document_read on public.documents for select to authenticated using(public.owns_candidate(candidate_id) or public.can_candidate(candidate_id,'documents.read'));
create policy messages_read on public.messages for select to authenticated using(public.owns_candidate(candidate_id) or public.can_candidate(candidate_id,'messages.read'));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy requests_read on public.privacy_requests for select to authenticated using(public.owns_candidate(candidate_id) or public.has_permission('privacy.manage'));
create policy acknowledgements_read on public.policy_acknowledgements for select to authenticated using(public.owns_candidate(candidate_id) or public.has_permission('privacy.manage'));
create policy policies_read on public.privacy_policies for select using(published_at is not null or public.has_permission('privacy.manage'));
create policy audit_read on public.audit_events for select to authenticated using(public.has_permission('audit.read'));
create policy staff_read on public.staff for select to authenticated using(user_id=auth.uid() or public.has_permission('users.manage'));
create policy staff_roles_read on public.staff_roles for select to authenticated using(user_id=auth.uid() or public.has_permission('roles.manage'));
create policy roles_read on public.roles for select to authenticated using(public.is_staff());
create policy permissions_read on public.permissions for select to authenticated using(public.is_staff());
create policy role_permissions_read on public.role_permissions for select to authenticated using(public.is_staff());
create policy assignments_read on public.job_assignments for select to authenticated using(user_id=auth.uid() or public.has_permission('jobs.manage',job_id));
create policy settings_read on public.settings for select to authenticated using(public.has_permission('settings.manage'));
create policy departments_read on public.departments for select using(active or public.has_permission('settings.manage'));
create policy areas_read on public.interest_areas for select using(active or public.has_permission('settings.manage'));
create policy templates_read on public.message_templates for select to authenticated using(public.has_permission('messages.read'));
create policy tags_read on public.tags for select to authenticated using(public.has_permission('candidates.read'));
create policy pools_read on public.talent_pools for select to authenticated using(public.has_permission('candidates.read'));
create policy candidate_tags_read on public.candidate_tags for select to authenticated using(public.can_candidate(candidate_id,'candidates.read'));
create policy pool_members_read on public.pool_members for select to authenticated using(public.can_candidate(candidate_id,'candidates.read'));

-- Only RPCs may change application state. Direct writes remain denied even with a valid JWT.
create function private.rate_limit(p_action text,p_max integer) returns void language plpgsql security definer set search_path='' as $$ declare n integer; begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 insert into private.rate_limits(user_id,action,bucket) values(auth.uid(),p_action,date_trunc('hour',now())) on conflict(user_id,action,bucket) do update set count=private.rate_limits.count+1 returning count into n;
 if n>p_max then raise exception 'rate_limit'; end if;
end $$;
create function private.require_permission(p_permission text,p_job uuid default null) returns void language plpgsql set search_path='' as $$ begin if not public.has_permission(p_permission,p_job) then raise exception 'permission_denied' using errcode='42501'; end if; end $$;
create function private.notify(p_user uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_user is not null then
 insert into public.notifications(user_id,title,body) values(p_user,p_title,p_body);
 insert into private.outbox(recipient_id,subject,body) values(p_user,p_title,p_body);
 end if;
end $$;

create function public.save_candidate(p_data jsonb,p_candidate_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; em text; owner uuid; aid text; lim integer; begin
 perform private.rate_limit('profile',60);
 if p_candidate_id is null then
 select id into cid from public.candidates where user_id=auth.uid();
 select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if em is null then raise exception 'email_verification_required'; end if;
 owner=auth.uid();
 else
 cid=p_candidate_id;
 if not public.owns_candidate(cid) and not public.can_candidate(cid,'candidates.edit') then raise exception 'permission_denied' using errcode='42501'; end if;
 select email,user_id into em,owner from public.candidates where id=cid;
 end if;
 if length(p_data->>'full_name') not between 2 and 160 then raise exception 'invalid_name'; end if;
 if cid is null then
 insert into public.candidates(user_id,email,full_name,created_by) values(owner,em,p_data->>'full_name',auth.uid()) returning id into cid;
 end if;
 update public.candidates set full_name=p_data->>'full_name',phone=left(coalesce(p_data->>'phone',''),30),city=left(coalesce(p_data->>'city',''),100),state=left(coalesce(p_data->>'state',''),2),headline=left(coalesce(p_data->>'headline',''),160),summary=left(coalesce(p_data->>'summary',''),4000),
 skills=array(select jsonb_array_elements_text(coalesce(p_data->'skills','[]')) limit 30),availability=left(coalesce(p_data->>'availability',''),100),work_model=left(coalesce(p_data->>'work_model',''),30),professional_url=left(coalesce(p_data->>'professional_url',''),500) where id=cid;
 lim=coalesce((select (value::text)::integer from public.settings where key='max_interest_areas'),3);
 if jsonb_array_length(coalesce(p_data->'interests','[]'))>lim then raise exception 'too_many_interests'; end if;
 delete from public.candidate_interests where candidate_id=cid;
 for aid in select jsonb_array_elements_text(coalesce(p_data->'interests','[]')) loop
 insert into public.candidate_interests(candidate_id,area_id) select cid,id from public.interest_areas where id=aid::uuid and active on conflict do nothing;
 end loop;
 return cid;
end $$;

create function public.create_manual_candidate(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$ declare cid uuid; begin
 perform private.require_permission('candidates.create');
 if length(coalesce(p_data->>'legal_basis',''))<3 or length(coalesce(p_data->>'source',''))<3 then raise exception 'purpose_required'; end if;
 insert into public.candidates(full_name,email,city,headline,source,processing_purpose,legal_basis,created_by)
 values(p_data->>'full_name',lower(p_data->>'email'),coalesce(p_data->>'city',''),coalesce(p_data->>'headline',''),p_data->>'source',p_data->>'processing_purpose',p_data->>'legal_basis',auth.uid()) returning id into cid;
 return cid;
end $$;
create function public.save_profile_entry(p_candidate_id uuid,p_data jsonb,p_entry_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$ declare eid uuid; begin
 if not public.owns_candidate(p_candidate_id) and not public.can_candidate(p_candidate_id,'candidates.edit') then raise exception 'permission_denied' using errcode='42501'; end if;
 perform private.rate_limit('profile_entry',100);
 if p_entry_id is null then
 insert into public.profile_entries(candidate_id,kind,title,organization,start_date,end_date,description) values(p_candidate_id,p_data->>'kind',p_data->>'title',coalesce(p_data->>'organization',''),nullif(p_data->>'start_date','')::date,nullif(p_data->>'end_date','')::date,coalesce(p_data->>'description','')) returning id into eid;
 else
 delete from public.profile_entries where id=p_entry_id and candidate_id=p_candidate_id returning id into eid;
 end if; return eid;
end $$;
create function public.save_privacy(p_policy_id uuid,p_talent_pool boolean) returns void language plpgsql security definer set search_path='' as $$ declare cid uuid; begin
 select id into cid from public.candidates where user_id=auth.uid();
 if cid is null or not exists(select 1 from public.privacy_policies where id=p_policy_id and active and published_at<=now()) then raise exception 'invalid_policy'; end if;
 insert into public.policy_acknowledgements(candidate_id,policy_id,purpose,granted) values(cid,p_policy_id,'notice',true),(cid,p_policy_id,'talent_pool',p_talent_pool);
 update public.candidates set talent_pool=p_talent_pool where id=cid;
end $$;

create function public.save_job(p_data jsonb,p_job_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$ declare jid uuid; begin
 perform private.require_permission('jobs.manage',p_job_id);
 if p_job_id is null then
 insert into public.jobs(title,slug,city,description,work_model,created_by) values(p_data->>'title',p_data->>'slug',p_data->>'city',p_data->>'description',p_data->>'work_model',auth.uid()) returning id into jid;
 insert into public.job_stages(job_id,name,position) values(jid,'Inscrição',0),(jid,'Triagem',1),(jid,'Entrevista RH',2),(jid,'Entrevista com gestor',3),(jid,'Proposta',4);
 insert into public.job_stages(job_id,name,position,terminal) values(jid,'Contratado',5,true),(jid,'Não selecionado',6,true);
 else jid=p_job_id; end if;
 update public.jobs set title=p_data->>'title',city=p_data->>'city',state=coalesce(p_data->>'state',''),department_id=nullif(p_data->>'department_id','')::uuid,description=p_data->>'description',responsibilities=coalesce(p_data->>'responsibilities',''),requirements=coalesce(p_data->>'requirements',''),benefits=coalesce(p_data->>'benefits',''),work_model=p_data->>'work_model',contract_type=coalesce(p_data->>'contract_type','CLT'),openings=coalesce((p_data->>'openings')::integer,1),deadline=nullif(p_data->>'deadline','')::timestamptz where id=jid;
 return jid;
end $$;
create function public.set_job_status(p_job_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('jobs.publish',p_job_id);
 update public.jobs set status=p_status,published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end where id=p_job_id;
end $$;
create function public.add_job_item(p_job_id uuid,p_kind text,p_label text,p_required boolean default false) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('jobs.manage',p_job_id);
 perform 1 from public.jobs where id=p_job_id for update;
 if p_kind='stage' then insert into public.job_stages(job_id,name,position) select p_job_id,p_label,coalesce(max(position),-1)+1 from public.job_stages where job_id=p_job_id;
 elsif p_kind='question' then insert into public.job_questions(job_id,label,required) values(p_job_id,p_label,p_required);
 else raise exception 'invalid_kind'; end if;
end $$;
create function public.submit_application(p_job_id uuid,p_answers jsonb,p_policy_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; sid uuid; rid uuid; aid uuid; q record; begin
 perform private.rate_limit('application',20);
 perform 1 from public.jobs where id=p_job_id and status='published' and visibility='public' and (deadline is null or deadline>now()) for update;
 if not found then raise exception 'job_unavailable'; end if;
 select id into cid from public.candidates where user_id=auth.uid() and archived_at is null and city<>'';
 if cid is null then raise exception 'complete_profile'; end if;
 if not exists(select 1 from public.privacy_policies where id=p_policy_id and active and published_at<=now()) then raise exception 'invalid_policy'; end if;
 select id into sid from public.job_stages where job_id=p_job_id order by position limit 1;
 select id into rid from public.documents where candidate_id=cid and kind='resume' and status='clean' order by created_at desc limit 1;
 if rid is null then raise exception 'clean_resume_required'; end if;
 for q in select * from public.job_questions where job_id=p_job_id loop
 if q.required and length(trim(coalesce(p_answers->>q.id::text,'')))=0 then raise exception 'answer_required'; end if;
 end loop;
 insert into public.applications(candidate_id,job_id,stage_id,resume_id) values(cid,p_job_id,sid,rid) returning id into aid;
 insert into public.application_answers(application_id,question_id,answer) select aid,id,coalesce(p_answers->>id::text,'') from public.job_questions where job_id=p_job_id;
 insert into public.policy_acknowledgements(candidate_id,policy_id,purpose,granted) values(cid,p_policy_id,'notice',true);
 insert into public.application_events(application_id,to_stage,actor_id) values(aid,sid,auth.uid());
 perform private.notify(auth.uid(),'Candidatura recebida','Sua candidatura foi recebida. Acompanhe as próximas etapas no portal.');
 return aid;
end $$;
create function public.move_application(p_application_id uuid,p_stage_id uuid,p_expected_stage uuid,p_note text default '') returns void language plpgsql security definer set search_path='' as $$ declare a public.applications; uid uuid; begin
 select * into a from public.applications where id=p_application_id for update;
 perform private.require_permission('applications.move',a.job_id);
 if a.stage_id<>p_expected_stage or a.status<>'active' then raise exception 'application_changed'; end if;
 if not exists(select 1 from public.job_stages where id=p_stage_id and job_id=a.job_id) then raise exception 'invalid_stage'; end if;
 update public.applications set stage_id=p_stage_id where id=a.id;
 insert into public.application_events(application_id,from_stage,to_stage,actor_id,note) values(a.id,a.stage_id,p_stage_id,auth.uid(),left(p_note,2000));
 select user_id into uid from public.candidates where id=a.candidate_id;
 perform private.notify(uid,'Sua candidatura avançou','Há uma atualização no seu processo seletivo. Confira no portal.');
end $$;
create function public.withdraw_application(p_application_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.owns_application(p_application_id) then raise exception 'permission_denied' using errcode='42501'; end if;
 update public.applications set status='withdrawn' where id=p_application_id and status='active';
 insert into public.application_events(application_id,actor_id,note) values(p_application_id,auth.uid(),'Candidatura retirada pelo titular.');
end $$;
