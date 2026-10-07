-- Access restrictions are independent of curriculum consent and archival.
create table private.portal_account_access (
 user_id uuid primary key references auth.users on delete cascade,
 active boolean not null,
 reason text not null check(char_length(trim(reason)) between 3 and 1000),
 changed_by uuid not null references auth.users,
 changed_at timestamptz not null default now(),
 revoked_before timestamptz not null
);
alter table private.portal_account_access enable row level security;
create policy deny_direct_portal_account_access on private.portal_account_access for all to public using(false) with check(false);
revoke all on private.portal_account_access from public,anon,authenticated,service_role;

create function public.portal_session_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not exists(
  select 1 from private.portal_account_access a where a.user_id=auth.uid()
   and (not a.active or not exists(select 1 from auth.sessions s where s.user_id=a.user_id
    and s.id::text=auth.jwt()->>'session_id' and s.created_at>a.revoked_before))
 )
$$;
revoke all on function public.portal_session_allowed() from public,anon,authenticated,service_role;
grant execute on function public.portal_session_allowed() to authenticated;
create function private.require_portal_session() returns void
language plpgsql set search_path='' as $$ begin
 if not public.portal_session_allowed() then raise exception 'portal_access_disabled' using errcode='42501'; end if;
end $$;
revoke all on function private.require_portal_session() from public,anon,authenticated,service_role;

create or replace function public.owns_candidate(p_candidate_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.portal_session_allowed() and exists(select 1 from public.candidates
  where id=p_candidate_id and user_id=auth.uid() and archived_at is null)
$$;
create or replace function public.owns_application(p_application_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.applications where id=p_application_id and public.owns_candidate(candidate_id))
$$;
create or replace function public.owns_job_application(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.applications where job_id=p_job_id and public.owns_candidate(candidate_id))
$$;
-- Anon needs the ownership helpers for public-job RLS; no private data is returned.
grant execute on function public.portal_session_allowed() to anon;
drop policy notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
 using(user_id=auth.uid() and public.portal_session_allowed());

-- Preserve the validated implementations, defaults and grants. Guard every
-- candidate-facing definer RPC, including those that query ownership directly.
do $$ declare f record; parameters text; signature text; implementation text; begin
 for f in select p.oid,p.proname,p.proargnames,p.prorettype,
   pg_get_function_arguments(p.oid) args,pg_get_function_identity_arguments(p.oid) identity_args,
   pg_get_function_result(p.oid) result_type
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('save_candidate','save_privacy','submit_application','save_profile_entry',
    'update_profile_entry','withdraw_application','request_privacy','send_message','mark_notification',
    'register_document','authorize_download','authorize_curriculum_export','export_my_data',
    'my_registration','update_account_name','consume_account_email_code','set_account_mfa')
 loop
  select coalesce(string_agg(quote_ident(name),','),'') into parameters from unnest(f.proargnames) name;
  signature:=format('public.%I(%s)',f.proname,f.identity_args);
  execute format('alter function %s rename to %I',signature,f.proname||'_portal_base');
  execute format('alter function public.%I(%s) set schema private',f.proname||'_portal_base',f.identity_args);
  execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role',f.proname||'_portal_base',f.identity_args);
  implementation:=case when f.prorettype='void'::regtype then format('perform private.%I(%s);',f.proname||'_portal_base',parameters)
   else format('return private.%I(%s);',f.proname||'_portal_base',parameters) end;
  execute format('create function public.%I(%s) returns %s language plpgsql security definer set search_path='''' as %L',
   f.proname,f.args,f.result_type,'begin perform private.require_portal_session(); '||implementation||' end');
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,f.identity_args);
  execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.identity_args);
 end loop;
end $$;

create function public.list_portal_accounts(p_search text default '',p_active boolean default null,p_page integer default 1)
returns table(user_id uuid,email text,display_name text,created_at timestamptz,confirmed_at timestamptz,
 last_sign_in_at timestamptz,candidate_id uuid,talent_pool boolean,active boolean,reason text,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
declare term text;
begin
 perform private.require_primary_administrator();
 if p_search is null or char_length(p_search)>100 or p_page is null or p_page not between 1 and 10000 then raise exception 'invalid_account_filter'; end if;
 term:='%'||replace(replace(replace(trim(p_search),'\','\\'),'%','\%'),'_','\_')||'%';
 return query select u.id,u.email::text,coalesce(c.full_name,''),u.created_at,u.email_confirmed_at,
  u.last_sign_in_at,c.id,coalesce(c.talent_pool,false),coalesce(a.active,true),coalesce(a.reason,''),count(*) over()
 from auth.users u left join public.candidates c on c.user_id=u.id
 left join private.portal_account_access a on a.user_id=u.id
 where u.raw_app_meta_data->>'provider'='email' and not exists(select 1 from public.staff s where s.user_id=u.id)
  and (p_active is null or coalesce(a.active,true)=p_active)
  and (u.email ilike term or c.full_name ilike term)
 order by u.created_at desc,u.id limit 20 offset (p_page-1)*20;
end $$;

create function public.set_portal_account_access(p_user_id uuid,p_active boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_primary_administrator();
 perform pg_advisory_xact_lock(726349);
 if p_active is null or p_reason is null or char_length(trim(p_reason)) not between 3 and 1000 then raise exception 'account_reason_required'; end if;
 perform 1 from auth.users u where u.id=p_user_id and u.raw_app_meta_data->>'provider'='email'
  and u.id<>auth.uid() and not exists(select 1 from public.staff s where s.user_id=u.id) for update;
 if not found then raise exception 'invalid_portal_account'; end if;
 if coalesce((select active from private.portal_account_access where user_id=p_user_id),true)=p_active then return; end if;
 insert into private.portal_account_access(user_id,active,reason,changed_by,revoked_before)
 values(p_user_id,p_active,trim(p_reason),auth.uid(),clock_timestamp())
 on conflict(user_id) do update set active=excluded.active,reason=excluded.reason,changed_by=excluded.changed_by,
  changed_at=now(),revoked_before=excluded.revoked_before;
 insert into public.audit_events(actor_id,action,resource,resource_id)
 values(auth.uid(),case when p_active then 'REACTIVATE' else 'DEACTIVATE' end,'portal_account_access',p_user_id::text);
end $$;
revoke all on function public.list_portal_accounts(text,boolean,integer),public.set_portal_account_access(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.list_portal_accounts(text,boolean,integer),public.set_portal_account_access(uuid,boolean,text) to authenticated;
