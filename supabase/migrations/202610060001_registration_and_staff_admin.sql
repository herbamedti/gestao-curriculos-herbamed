-- Registration data never enters JWT metadata or a public table.
create function private.valid_cpf(p_cpf text) returns boolean
language plpgsql immutable set search_path='' as $$
declare n integer; total integer; check_digit integer; i integer;
begin
 if p_cpf is null or p_cpf !~ '^[0-9]{11}$' or p_cpf ~ '^([0-9])\1{10}$' then return false; end if;
 for n in 9..10 loop
  total:=0;
  for i in 1..n loop total:=total+substr(p_cpf,i,1)::integer*(n+2-i); end loop;
  check_digit:=(total*10)%11%10;
  if check_digit<>substr(p_cpf,n+1,1)::integer then return false; end if;
 end loop;
 return true;
end $$;

create table private.candidate_signup_tickets (
 ticket_hash text primary key check(ticket_hash ~ '^[a-f0-9]{64}$'),
 email text not null check(char_length(email)<=254),
 cpf text not null check(private.valid_cpf(cpf)),
 birth_date date not null check(birth_date>='1900-01-01'),
 expires_at timestamptz not null default now()+interval '10 minutes'
);
create table private.candidate_registration (
 user_id uuid primary key references auth.users on delete cascade,
 cpf text not null check(private.valid_cpf(cpf)),
 birth_date date not null check(birth_date>='1900-01-01'),
 created_at timestamptz not null default now()
);
alter table private.candidate_signup_tickets enable row level security;
alter table private.candidate_registration enable row level security;
create policy deny_direct_signup_tickets on private.candidate_signup_tickets for all to public using(false) with check(false);
create policy deny_direct_registration on private.candidate_registration for all to public using(false) with check(false);
revoke all on private.candidate_signup_tickets,private.candidate_registration from public,anon,authenticated,service_role,supabase_auth_admin;

create function public.prepare_candidate_signup(p_origin_key text,p_email_key text,p_email text,p_cpf text,p_birth_date date,p_ticket_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare accepted integer; minute_bucket timestamptz:=date_trunc('minute',now());
begin
 if auth.role() is distinct from 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_origin_key !~ '^[a-f0-9]{64}$' or p_email_key !~ '^[a-f0-9]{64}$' or p_ticket_hash !~ '^[a-f0-9]{64}$'
  or p_origin_key is null or p_email_key is null or p_ticket_hash is null
  or not private.valid_cpf(p_cpf) or p_birth_date is null or p_birth_date<'1900-01-01'
  or p_birth_date>(now() at time zone 'America/Sao_Paulo')::date
  or p_email is null or char_length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 then raise exception 'invalid_registration'; end if;
 -- All quotas commit when denied (return false instead of raising).
 if not public.consume_signup_quota(p_origin_key) then return false; end if;
 insert into private.signup_limits(key,bucket,count) values('burst:'||p_origin_key,minute_bucket,1)
 on conflict(key,bucket) do update set count=private.signup_limits.count+1 where private.signup_limits.count<3 returning count into accepted;
 if accepted is null then return false; end if;
 accepted:=null;
 insert into private.signup_limits(key,bucket,count) values('email:'||p_email_key,date_trunc('hour',now()),1)
 on conflict(key,bucket) do update set count=private.signup_limits.count+1 where private.signup_limits.count<3 returning count into accepted;
 if accepted is null then return false; end if;
 delete from private.candidate_signup_tickets where expires_at<now();
 insert into private.candidate_signup_tickets(ticket_hash,email,cpf,birth_date)
 values(p_ticket_hash,lower(trim(p_email)),p_cpf,p_birth_date);
 return true;
end $$;

-- Enable this PostgreSQL Before User Created hook in hosted Supabase. It also
-- prevents direct public Auth calls from skipping the application's controls.
create function public.guard_candidate_signup(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ticket text:=event->'user'->'user_metadata'->>'registration_ticket';
begin
 if event->'user'->'app_metadata'->>'provider'='azure' then return '{}'::jsonb; end if;
 if event->'user'->'app_metadata'->>'provider'='email' and ticket ~ '^[a-f0-9]{64}$'
  and exists(select 1 from private.candidate_signup_tickets t
    where t.ticket_hash=encode(extensions.digest(ticket,'sha256'),'hex') and t.expires_at>now()
    and t.email=lower(event->'user'->>'email')) then return '{}'::jsonb; end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use o cadastro da plataforma Herbamed para criar sua conta.'));
end $$;

create function private.attach_candidate_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare ticket text:=new.raw_user_meta_data->>'registration_ticket'; info private.candidate_signup_tickets%rowtype;
begin
 if ticket is null then return new; end if;
 if ticket !~ '^[a-f0-9]{64}$' then raise exception 'invalid_registration'; end if;
 delete from private.candidate_signup_tickets where ticket_hash=encode(extensions.digest(ticket,'sha256'),'hex')
  and email=lower(new.email) and expires_at>now() returning * into info;
 if not found then raise exception 'invalid_registration'; end if;
 insert into private.candidate_registration(user_id,cpf,birth_date) values(new.id,info.cpf,info.birth_date);
 return new;
end $$;
create trigger attach_candidate_registration after insert on auth.users for each row execute function private.attach_candidate_registration();

create function public.my_registration() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('cpf_masked','***.***.***-'||right(cpf,2),'birth_date',birth_date)
 from private.candidate_registration where user_id=auth.uid()
$$;

alter function public.export_my_data() rename to export_curriculum_data;
alter function public.export_curriculum_data() set schema private;
create function public.export_my_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; registration jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if exists(select 1 from public.candidates where user_id=auth.uid()) then
  result:=private.export_curriculum_data();
 else
  perform private.rate_limit('export_self',5);
  result:='{}'::jsonb;
 end if;
 select jsonb_build_object('cpf',cpf,'birth_date',birth_date,'created_at',created_at) into registration
 from private.candidate_registration where user_id=auth.uid();
 return result||jsonb_build_object('registration',registration);
end $$;
revoke all on function private.export_curriculum_data(),public.export_my_data() from public,anon,authenticated,service_role;
grant execute on function public.export_my_data() to authenticated;

-- The first existing Superadministrator remains the only account that can
-- provision staff. No email address, password or secret is stored in migration.
create table private.primary_administrator (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null unique references auth.users on delete restrict
);
alter table private.primary_administrator enable row level security;
create policy deny_direct_primary_admin on private.primary_administrator for all to public using(false) with check(false);
revoke all on private.primary_administrator from public,anon,authenticated,service_role;
insert into private.primary_administrator(user_id)
 select s.user_id from public.staff s join public.staff_roles sr on sr.user_id=s.user_id join public.roles r on r.id=sr.role_id
 where s.active and r.active and r.name='Superadministrador' order by s.created_at,s.user_id limit 1;

create function private.initialize_primary_administrator() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.roles where id=new.role_id and name='Superadministrador' and active)
  and exists(select 1 from public.staff where user_id=new.user_id and active) then
  insert into private.primary_administrator(user_id) values(new.user_id) on conflict(singleton) do nothing;
 end if;
 return new;
end $$;
create trigger initialize_primary_administrator after insert on public.staff_roles for each row execute function private.initialize_primary_administrator();

create table private.staff_session_revocations (
 user_id uuid primary key references auth.users on delete cascade,
 revoked_before timestamptz not null
);
alter table private.staff_session_revocations enable row level security;
create policy deny_direct_staff_revocations on private.staff_session_revocations for all to public using(false) with check(false);
revoke all on private.staff_session_revocations from public,anon,authenticated,service_role;

create function private.staff_session_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.staff_session_revocations r where r.user_id=p_user_id
  and not exists(select 1 from auth.sessions s where s.user_id=p_user_id and s.id::text=auth.jwt()->>'session_id' and s.created_at>r.revoked_before))
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff s where s.user_id=auth.uid() and s.active and private.staff_session_allowed(s.user_id)
  and (auth.jwt()->'app_metadata'->>'provider'='azure'
   or (select allow_local_password_staff from private.security_config where singleton)
   or (s.password_login_enabled and auth.jwt()->'app_metadata'->>'provider'='email')))
$$;
create function public.is_primary_administrator() returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_staff() and auth.jwt()->>'aal'='aal2' and exists(select 1 from private.primary_administrator where user_id=auth.uid())
$$;
create or replace function public.has_permission(p_permission text,p_job_id uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_staff() and (p_permission not in ('users.manage','roles.manage') or public.is_primary_administrator())
 and exists(select 1 from public.staff s join public.staff_roles sr on sr.user_id=s.user_id
 join public.roles r on r.id=sr.role_id join public.role_permissions rp on rp.role_id=r.id
 where s.user_id=auth.uid() and r.active and rp.permission=p_permission
 and (not s.mfa_enabled or auth.jwt()->>'aal'='aal2')
 and (r.scope='all' or (p_job_id is not null and exists(select 1 from public.job_assignments ja where ja.job_id=p_job_id and ja.user_id=s.user_id))))
$$;
create function private.require_primary_administrator() returns void
language plpgsql set search_path='' as $$
begin
 if not coalesce(public.is_primary_administrator(),false) then raise exception 'permission_denied' using errcode='42501'; end if;
end $$;

create function public.list_managed_staff() returns table(user_id uuid,display_name text,email text,active boolean,mfa_enabled boolean,role_id uuid,is_primary boolean,password_login_enabled boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_primary_administrator();
 return query select s.user_id,s.display_name,u.email::text,s.active,s.mfa_enabled,sr.role_id,
  exists(select 1 from private.primary_administrator p where p.user_id=s.user_id),s.password_login_enabled
 from public.staff s join auth.users u on u.id=s.user_id left join public.staff_roles sr on sr.user_id=s.user_id order by s.created_at;
end $$;

-- Auth creation occurs only through the server admin API. This RPC attaches
-- domain access atomically after the actor's AAL2 was checked in their own JWT.
create function public.provision_staff(p_actor_id uuid,p_user_id uuid,p_name text,p_role_id uuid,p_active boolean,p_mfa boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from private.primary_administrator p
  join public.staff s on s.user_id=p.user_id where p.user_id=p_actor_id and s.active) then raise exception 'permission_denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(726349);
 if p_user_id=p_actor_id or exists(select 1 from public.staff where user_id=p_user_id)
  or not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null and raw_app_meta_data->>'provider'='email') then raise exception 'invalid_staff_target'; end if;
 if p_active is null or p_mfa is null or char_length(trim(p_name)) not between 2 and 160
  or not exists(select 1 from public.roles where id=p_role_id and active) then raise exception 'invalid_staff'; end if;
 insert into public.staff(user_id,display_name,active,mfa_enabled,password_login_enabled) values(p_user_id,trim(p_name),p_active,p_mfa,true);
 insert into public.staff_roles(user_id,role_id) values(p_user_id,p_role_id);
 insert into public.audit_events(actor_id,action,resource,resource_id) values(p_actor_id,'PROVISION','staff',p_user_id::text);
end $$;

create function public.update_managed_staff(p_user_id uuid,p_name text,p_role_id uuid,p_active boolean,p_mfa boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_primary_administrator();
 perform private.rate_limit('staff_admin',30);
 perform pg_advisory_xact_lock(726349);
 if p_user_id=auth.uid() or exists(select 1 from private.primary_administrator where user_id=p_user_id)
  or not exists(select 1 from public.staff where user_id=p_user_id) then raise exception 'invalid_staff_target'; end if;
 if p_active is null or p_mfa is null or char_length(trim(p_name)) not between 2 and 160
  or not exists(select 1 from public.roles where id=p_role_id and active) then raise exception 'invalid_staff'; end if;
 update public.staff set display_name=trim(p_name),active=p_active,mfa_enabled=p_mfa where user_id=p_user_id;
 delete from public.staff_roles where user_id=p_user_id;
 insert into public.staff_roles(user_id,role_id) values(p_user_id,p_role_id);
end $$;

create function public.authorize_staff_password_reset(p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_primary_administrator();
 perform private.rate_limit('staff_password_reset',10);
 if p_user_id=auth.uid() or exists(select 1 from private.primary_administrator where user_id=p_user_id)
  or not exists(select 1 from public.staff s join auth.users u on u.id=s.user_id where s.user_id=p_user_id and s.password_login_enabled and u.raw_app_meta_data->>'provider'='email')
 then return false; end if;
 return true;
end $$;
create function public.finish_staff_password_reset(p_actor_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_user_id=p_actor_id
  or not exists(select 1 from private.primary_administrator p join public.staff s on s.user_id=p.user_id where p.user_id=p_actor_id and s.active)
  or not exists(select 1 from public.staff where user_id=p_user_id and password_login_enabled)
 then raise exception 'permission_denied' using errcode='42501'; end if;
 insert into private.staff_session_revocations(user_id,revoked_before) values(p_user_id,clock_timestamp())
 on conflict(user_id) do update set revoked_before=excluded.revoked_before;
 insert into public.audit_events(actor_id,action,resource,resource_id) values(p_actor_id,'PASSWORD_RESET','staff',p_user_id::text);
end $$;

-- Keep the old RPC signature, but close its former privilege-granting route.
create or replace function public.manage_staff(p_email text,p_name text,p_role_id uuid,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid; mfa boolean;
begin
 perform private.require_primary_administrator();
 select s.user_id,s.mfa_enabled into target,mfa from public.staff s join auth.users u on u.id=s.user_id where lower(u.email)=lower(p_email);
 if target is null then raise exception 'use_staff_creation'; end if;
 perform public.update_managed_staff(target,p_name,p_role_id,p_active,mfa);
end $$;

revoke all on function private.valid_cpf(text),private.attach_candidate_registration(),private.initialize_primary_administrator(),
 private.staff_session_allowed(uuid),private.require_primary_administrator(),public.prepare_candidate_signup(text,text,text,text,date,text),
 public.guard_candidate_signup(jsonb),public.my_registration(),public.is_primary_administrator(),public.list_managed_staff(),
 public.provision_staff(uuid,uuid,text,uuid,boolean,boolean),public.update_managed_staff(uuid,text,uuid,boolean,boolean),
 public.authorize_staff_password_reset(uuid),public.finish_staff_password_reset(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_candidate_signup(text,text,text,text,date,text),public.provision_staff(uuid,uuid,text,uuid,boolean,boolean),public.finish_staff_password_reset(uuid,uuid) to service_role;
grant execute on function public.guard_candidate_signup(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.my_registration(),public.is_primary_administrator(),public.list_managed_staff(),public.update_managed_staff(uuid,text,uuid,boolean,boolean),public.authorize_staff_password_reset(uuid) to authenticated;
