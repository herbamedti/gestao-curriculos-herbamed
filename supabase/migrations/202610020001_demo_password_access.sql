-- Password login is authorized per staff account; existing Azure and local
-- behavior remain intact. MFA, role permissions and job scope still apply.
alter table public.staff add column password_login_enabled boolean not null default false;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.staff s where s.user_id=auth.uid() and s.active
   and (auth.jwt()->'app_metadata'->>'provider'='azure'
     or (select allow_local_password_staff from private.security_config where singleton)
     or (s.password_login_enabled and auth.jwt()->'app_metadata'->>'provider'='email'))
 )
$$;

create or replace function public.has_permission(p_permission text,p_job_id uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.staff s
   join public.staff_roles sr on sr.user_id=s.user_id
   join public.roles r on r.id=sr.role_id
   join public.role_permissions rp on rp.role_id=r.id
   where s.user_id=auth.uid() and s.active and r.active and rp.permission=p_permission
   and (auth.jwt()->'app_metadata'->>'provider'='azure'
     or (select allow_local_password_staff from private.security_config where singleton)
     or (s.password_login_enabled and auth.jwt()->'app_metadata'->>'provider'='email'))
   and (not r.require_mfa or not s.mfa_enabled or auth.jwt()->>'aal'='aal2')
   and (r.scope='all' or (p_job_id is not null and exists(
     select 1 from public.job_assignments ja where ja.job_id=p_job_id and ja.user_id=s.user_id)))
 )
$$;

-- Deployment tool only. Registration can never call this or grant a role.
create function public.bootstrap_password_staff(p_user_id uuid,p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare admin_role uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
 if char_length(trim(p_display_name)) not between 2 and 160 then raise exception 'invalid_name'; end if;
 perform pg_advisory_xact_lock(610020001);
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null
   and raw_app_meta_data->>'provider'='email') then raise exception 'confirmed_password_user_required'; end if;
 select id into admin_role from public.roles where name='Superadministrador' and active;
 if admin_role is null then raise exception 'admin_role_missing'; end if;
 if exists(select 1 from public.staff where user_id=p_user_id and active and password_login_enabled
   and exists(select 1 from public.staff_roles where user_id=p_user_id and role_id=admin_role)) then return p_user_id; end if;
 if exists(select 1 from public.staff) then raise exception 'staff_already_exists'; end if;
 insert into public.staff(user_id,display_name,password_login_enabled) values(p_user_id,trim(p_display_name),true);
 insert into public.staff_roles(user_id,role_id) values(p_user_id,admin_role);
 return p_user_id;
end $$;

-- Pseudonymous, short-lived registration quota. There is no raw IP or email.
create table private.signup_limits (
 key text not null,
 bucket timestamptz not null,
 count integer not null check(count>0),
 primary key(key,bucket)
);
alter table private.signup_limits enable row level security;
create policy deny_direct_signup_limits on private.signup_limits for all to public using(false) with check(false);
revoke all on private.signup_limits from public,anon,authenticated,service_role;

create function public.consume_signup_quota(p_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare current_bucket timestamptz := date_trunc('hour',now()); accepted integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' then return false; end if;
 delete from private.signup_limits where bucket < now()-interval '1 day';
 insert into private.signup_limits(key,bucket,count) values(p_key,current_bucket,1)
 on conflict(key,bucket) do update set count=private.signup_limits.count+1 where private.signup_limits.count<5
 returning count into accepted;
 if accepted is null then return false; end if;
 accepted := null;
 insert into private.signup_limits(key,bucket,count) values('global',current_bucket,1)
 on conflict(key,bucket) do update set count=private.signup_limits.count+1 where private.signup_limits.count<100
 returning count into accepted;
 return accepted is not null;
end $$;

revoke all on function public.bootstrap_password_staff(uuid,text),public.consume_signup_quota(text) from public,anon,authenticated,service_role;
grant execute on function public.bootstrap_password_staff(uuid,text),public.consume_signup_quota(text) to service_role;
