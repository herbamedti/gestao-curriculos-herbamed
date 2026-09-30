create extension if not exists pgcrypto with schema extensions;

-- The default remains mandatory. An individual staff member can opt out only
-- after an authenticated step-up, which is audited through the staff trigger.
alter table public.staff add column mfa_enabled boolean not null default true;

create or replace function public.has_permission(p_permission text, p_job_id uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.staff s
   join public.staff_roles sr on sr.user_id=s.user_id
   join public.roles r on r.id=sr.role_id
   join public.role_permissions rp on rp.role_id=r.id
   where s.user_id=auth.uid() and s.active and r.active and rp.permission=p_permission
   and (auth.jwt()->'app_metadata'->>'provider'='azure'
        or (select allow_local_password_staff from private.security_config where singleton))
   and (not r.require_mfa or not s.mfa_enabled or auth.jwt()->>'aal'='aal2')
   and (r.scope='all' or (p_job_id is not null and exists(
     select 1 from public.job_assignments ja where ja.job_id=p_job_id and ja.user_id=s.user_id)))
 )
$$;

-- Only the server can issue a challenge; no browser role can read its hash.
create table private.account_email_challenges (
 user_id uuid primary key references auth.users on delete cascade,
 code_hash text not null,
 expires_at timestamptz not null,
 issued_at timestamptz not null default now(),
 attempts integer not null default 0 check(attempts between 0 and 5),
 window_started_at timestamptz not null default now(),
 sends_in_window integer not null default 1
);
alter table private.account_email_challenges enable row level security;
revoke all on private.account_email_challenges from public, anon, authenticated;

create function private.consume_account_email_code(p_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare challenge private.account_email_challenges%rowtype;
begin
 if auth.uid() is null or p_code !~ '^[A-F0-9]{10}$' then return false; end if;
 select * into challenge from private.account_email_challenges
 where user_id=auth.uid() for update;
 if not found or challenge.expires_at < now() or challenge.attempts >= 5 then return false; end if;
 if challenge.code_hash <> encode(extensions.digest(p_code,'sha256'),'hex') then
   update private.account_email_challenges set attempts=attempts+1 where user_id=auth.uid();
   return false;
 end if;
 delete from private.account_email_challenges where user_id=auth.uid();
 return true;
end $$;

create function public.consume_account_email_code(p_code text) returns boolean
language sql security definer set search_path='' as $$
 select private.consume_account_email_code(p_code)
$$;

create function public.update_account_name(p_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if char_length(trim(p_name)) not between 2 and 160 then raise exception 'invalid_name'; end if;
 update public.staff set display_name=trim(p_name) where user_id=auth.uid() and active;
 update public.candidates set full_name=trim(p_name) where user_id=auth.uid() and archived_at is null;
end $$;

create function public.set_account_mfa(p_enabled boolean, p_email_code text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'permission_denied' using errcode='42501'; end if;
 if not p_enabled and auth.jwt()->>'aal' <> 'aal2' then
   if p_email_code is null or not private.consume_account_email_code(p_email_code) then
     raise exception 'step_up_required' using errcode='42501';
   end if;
 end if;
 update public.staff set mfa_enabled=p_enabled where user_id=auth.uid() and active;
end $$;

-- GoTrue changes auth.users.email only after its confirmation flow completes.
create function private.sync_candidate_login_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.email is distinct from old.email and new.email is not null then
   update public.candidates set email=new.email where user_id=new.id;
 end if;
 return new;
end $$;
create trigger sync_candidate_login_email after update of email on auth.users
for each row execute function private.sync_candidate_login_email();

revoke all on function private.consume_account_email_code(text),
 public.consume_account_email_code(text), public.update_account_name(text),
 public.set_account_mfa(boolean,text) from public, anon, authenticated;
grant execute on function public.consume_account_email_code(text),
 public.update_account_name(text), public.set_account_mfa(boolean,text) to authenticated;
