-- Internal invitations and per-user exceptions.
-- No tokens or credentials are kept in these domain tables.
create table private.staff_onboarding (
 user_id uuid primary key references public.staff(user_id) on delete cascade,
 created_by uuid references auth.users on delete set null,
 created_at timestamptz not null default now(), completed_at timestamptz,
 delivery text not null default 'pending' check(delivery in ('pending','sent','failed')),
 last_attempt_at timestamptz, sent_at timestamptz
);
create table private.staff_permission_overrides (
 user_id uuid not null references public.staff(user_id) on delete cascade,
 permission text not null references public.permissions(code) on delete cascade,
 allowed boolean not null, primary key(user_id,permission),
 check(permission not in ('users.manage','roles.manage'))
);
alter table private.staff_onboarding enable row level security;
alter table private.staff_permission_overrides enable row level security;
create policy deny_direct_staff_onboarding on private.staff_onboarding for all to public using(false) with check(false);
create policy deny_direct_staff_overrides on private.staff_permission_overrides for all to public using(false) with check(false);
revoke all on private.staff_onboarding,private.staff_permission_overrides from public,anon,authenticated,service_role;
insert into public.permissions(code,label) values ('settings.read','Visualizar configurações'),('privacy.read','Visualizar privacidade');
insert into public.role_permissions(role_id,permission)
 select role_id,'settings.read' from public.role_permissions where permission='settings.manage'
 union all select role_id,'privacy.read' from public.role_permissions where permission='privacy.manage';
create function private.staff_setup_complete(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.staff_onboarding where user_id=p_user_id and completed_at is null)
$$;
create or replace function private.staff_session_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.staff_session_allowed_before_google(p_user_id) and not private.google_staff_session_blocked() and private.staff_setup_complete(p_user_id)
$$;
create function private.internal_account_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.staff s where s.user_id=auth.uid() and (not s.active or not private.staff_session_allowed(s.user_id)))
$$;
create or replace function public.portal_session_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select private.portal_account_allowed() and not private.google_registration_required() and not private.google_staff_session_blocked() and private.internal_account_allowed()
$$;
create or replace function public.candidate_registration_status() returns text
language sql stable security definer set search_path='' as $$
 select case when not coalesce(private.portal_account_allowed(),false) or private.google_staff_session_blocked()
  or exists(select 1 from public.staff where user_id=auth.uid() and not active) then 'unavailable'
  when not private.staff_setup_complete(auth.uid()) then 'password_required'
  when not private.internal_account_allowed() then 'unavailable'
  when private.google_registration_required() then 'required' else 'complete' end
$$;
create function private.staff_effective_permission(p_permission text,p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff s join public.staff_roles sr on sr.user_id=s.user_id join public.roles r on r.id=sr.role_id
 where s.user_id=auth.uid() and r.active and (not s.mfa_enabled or auth.jwt()->>'aal'='aal2')
 and (r.scope='all' or (p_job_id is not null and exists(select 1 from public.job_assignments ja where ja.job_id=p_job_id and ja.user_id=s.user_id)))
 and coalesce((select o.allowed from private.staff_permission_overrides o where o.user_id=s.user_id and o.permission=p_permission),
  exists(select 1 from public.role_permissions rp where rp.role_id=r.id and rp.permission=p_permission)))
$$;
create or replace function public.has_permission(p_permission text,p_job_id uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_staff() and exists(select 1 from public.permissions where code=p_permission)
 and (p_permission not in ('users.manage','roles.manage') or public.is_primary_administrator())
 and private.staff_effective_permission(p_permission,p_job_id)
 and (p_permission like '%.read' or not exists(select 1 from public.permissions where code=split_part(p_permission,'.',1)||'.read')
  or private.staff_effective_permission(split_part(p_permission,'.',1)||'.read',p_job_id))
$$;
alter policy settings_read on public.settings using(public.has_permission('settings.read'));
alter policy departments_read on public.departments using(active or public.has_permission('settings.read'));
alter policy areas_read on public.interest_areas using(active or public.has_permission('settings.read'));
create policy settings_tags_read on public.tags for select to authenticated using(public.has_permission('settings.read'));
create policy settings_pools_read on public.talent_pools for select to authenticated using(public.has_permission('settings.read'));
create policy settings_levels_read on public.experience_levels for select to authenticated using(public.has_permission('settings.read'));
create policy settings_types_read on public.employment_types for select to authenticated using(public.has_permission('settings.read'));
create policy privacy_staff_read on public.privacy_requests for select to authenticated using(public.has_permission('privacy.read'));
create policy privacy_acknowledgements_read on public.policy_acknowledgements for select to authenticated using(public.has_permission('privacy.read'));
create policy privacy_history_read on public.privacy_policies for select to authenticated using(public.has_permission('privacy.read'));
create function private.set_staff_overrides(p_user_id uuid,p_permissions jsonb) returns void
language plpgsql set search_path='' as $$
begin
 if p_permissions is null or jsonb_typeof(p_permissions) is distinct from 'object' or pg_column_size(p_permissions)>20000
  or exists(select 1 from jsonb_each(p_permissions) e where e.key in ('users.manage','roles.manage')
   or jsonb_typeof(e.value)<>'boolean' or not exists(select 1 from public.permissions p where p.code=e.key))
 then raise exception 'invalid_permissions'; end if;
 if exists(select 1 from private.primary_administrator where user_id=p_user_id) then raise exception 'invalid_staff_target'; end if;
 delete from private.staff_permission_overrides where user_id=p_user_id;
 insert into private.staff_permission_overrides(user_id,permission,allowed) select p_user_id,key,value::text::boolean from jsonb_each(p_permissions);
end $$;
create function public.staff_administration_details() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_primary_administrator();
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',s.user_id,'created_at',s.created_at,
  'pending',o.user_id is not null and o.completed_at is null,'delivery',o.delivery,'sent_at',o.sent_at,
  'confirmed',u.email_confirmed_at is not null,'permissions',coalesce((select jsonb_object_agg(permission,allowed)
   from private.staff_permission_overrides where user_id=s.user_id),'{}'::jsonb)))
  from public.staff s join auth.users u on u.id=s.user_id left join private.staff_onboarding o on o.user_id=s.user_id),'[]'::jsonb);
end $$;
create function public.update_staff_administration(p_user_id uuid,p_name text,p_role_id uuid,p_active boolean,p_mfa boolean,p_permissions jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.update_managed_staff(p_user_id,p_name,p_role_id,p_active,p_mfa);
 perform private.set_staff_overrides(p_user_id,p_permissions);
 insert into public.audit_events(actor_id,action,resource,resource_id) values(auth.uid(),'PERMISSIONS_UPDATE','staff',p_user_id::text);
end $$;
create function private.revoke_deactivated_staff() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.active and not new.active then
  insert into private.staff_session_revocations(user_id,revoked_before) values(new.user_id,clock_timestamp())
  on conflict(user_id) do update set revoked_before=excluded.revoked_before;
 end if;
 return new;
end $$;
create trigger revoke_deactivated_staff after update of active on public.staff for each row execute function private.revoke_deactivated_staff();
create function public.provision_invited_staff(p_actor_id uuid,p_user_id uuid,p_name text,p_role_id uuid,p_active boolean,p_mfa boolean,p_permissions jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from private.primary_administrator p join public.staff s on s.user_id=p.user_id where p.user_id=p_actor_id and s.active)
 then raise exception 'permission_denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(726349);
 if p_user_id=p_actor_id or exists(select 1 from public.staff where user_id=p_user_id)
  or not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is null and invited_at is not null and raw_app_meta_data->>'provider'='email')
 then raise exception 'invalid_staff_target'; end if;
 if p_active is null or p_mfa is null or p_name is null or char_length(trim(p_name)) not between 2 and 160
  or not exists(select 1 from public.roles where id=p_role_id and active) then raise exception 'invalid_staff'; end if;
 insert into public.staff(user_id,display_name,active,mfa_enabled,password_login_enabled) values(p_user_id,trim(p_name),p_active,p_mfa,true);
 insert into private.staff_onboarding(user_id,created_by) values(p_user_id,p_actor_id);
 insert into public.staff_roles(user_id,role_id) values(p_user_id,p_role_id);
 perform private.set_staff_overrides(p_user_id,p_permissions);
 insert into public.audit_events(actor_id,action,resource,resource_id) values(p_actor_id,'INVITE_CREATE','staff',p_user_id::text);
end $$;
create function public.reserve_staff_invitation(p_user_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare accepted integer;
begin
 perform private.require_primary_administrator(); perform pg_advisory_xact_lock(726349);
 if p_user_id is not null and not exists(select 1 from private.staff_onboarding o join public.staff s on s.user_id=o.user_id
  where o.user_id=p_user_id and o.completed_at is null and s.active and (o.last_attempt_at is null or o.last_attempt_at<now()-interval '1 minute')) then return false; end if;
 insert into private.rate_limits(user_id,action,bucket,count) values(auth.uid(),'staff_invite',date_trunc('hour',now()),1)
 on conflict(user_id,action,bucket) do update set count=private.rate_limits.count+1 where private.rate_limits.count<20 returning count into accepted;
 if accepted is null then return false; end if;
 if p_user_id is not null then update private.staff_onboarding set last_attempt_at=now(),delivery='pending' where user_id=p_user_id; end if;
 return true;
end $$;
create function public.record_staff_invitation(p_actor_id uuid,p_user_id uuid,p_sent boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from private.primary_administrator p join public.staff s on s.user_id=p.user_id where p.user_id=p_actor_id and s.active)
 then raise exception 'permission_denied' using errcode='42501'; end if;
 update private.staff_onboarding set delivery=case when p_sent then 'sent' else 'failed' end,last_attempt_at=now(),
  sent_at=case when p_sent then now() else sent_at end where user_id=p_user_id and completed_at is null;
 insert into public.audit_events(actor_id,action,resource,resource_id) values(p_actor_id,case when p_sent then 'INVITE_SENT' else 'INVITE_FAILED' end,'staff',p_user_id::text);
end $$;
create function public.complete_staff_onboarding(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(726349);
 if not exists(select 1 from public.staff s join auth.users u on u.id=s.user_id join private.staff_onboarding o on o.user_id=s.user_id
  where s.user_id=p_user_id and s.active and o.completed_at is null and u.email_confirmed_at is not null and length(u.encrypted_password)>0)
 then raise exception 'invalid_staff_target'; end if;
 update private.staff_onboarding set completed_at=now() where user_id=p_user_id;
 insert into public.audit_events(actor_id,action,resource,resource_id) values(p_user_id,'ONBOARDING_COMPLETE','staff',p_user_id::text);
end $$;
revoke all on function private.staff_setup_complete(uuid),private.internal_account_allowed(),private.staff_effective_permission(text,uuid),private.set_staff_overrides(uuid,jsonb),private.revoke_deactivated_staff(),
 public.staff_administration_details(),public.update_staff_administration(uuid,text,uuid,boolean,boolean,jsonb),public.provision_invited_staff(uuid,uuid,text,uuid,boolean,boolean,jsonb),
 public.reserve_staff_invitation(uuid),public.record_staff_invitation(uuid,uuid,boolean),public.complete_staff_onboarding(uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_administration_details(),public.update_staff_administration(uuid,text,uuid,boolean,boolean,jsonb),public.reserve_staff_invitation(uuid) to authenticated;
grant execute on function public.provision_invited_staff(uuid,uuid,text,uuid,boolean,boolean,jsonb),public.record_staff_invitation(uuid,uuid,boolean),public.complete_staff_onboarding(uuid) to service_role;
