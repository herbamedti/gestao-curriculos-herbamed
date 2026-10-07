-- Google is candidate-only. Identification stays private and is enforced even
-- for direct Data API calls and after unlinking the Google identity.
create table private.google_candidate_accounts (
 user_id uuid primary key references auth.users on delete cascade,
 created_at timestamptz not null default now()
);
alter table private.google_candidate_accounts enable row level security;
create policy deny_direct_google_accounts on private.google_candidate_accounts for all to public using(false) with check(false);
revoke all on private.google_candidate_accounts from public,anon,authenticated,service_role,supabase_auth_admin;

create function private.track_google_candidate() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.provider='google' then
  insert into private.google_candidate_accounts(user_id) values(new.user_id) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger track_google_candidate after insert or update of provider on auth.identities
 for each row execute function private.track_google_candidate();
-- Install tracking before backfill so concurrent Auth writes cannot miss it.
insert into private.google_candidate_accounts(user_id)
 select user_id from auth.identities where provider='google' on conflict do nothing;

create function private.google_registration_required() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.google_candidate_accounts where user_id=auth.uid())
 and not exists(select 1 from public.staff where user_id=auth.uid())
 and not exists(select 1 from private.candidate_registration where user_id=auth.uid())
$$;

-- Auth AMR generally identifies OAuth, not which social provider signed in.
-- Fail closed for OAuth sessions of internal accounts ever linked to Google;
-- their authorized password sessions remain available with the existing MFA.
create function private.google_staff_session_blocked() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff where user_id=auth.uid())
 and exists(select 1 from private.google_candidate_accounts where user_id=auth.uid())
 and (auth.jwt()->'app_metadata'->>'provider'='google'
  or exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method'='oauth'))
$$;
create function private.staff_session_allowed_before_google(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.staff_session_revocations r where r.user_id=p_user_id
  and not exists(select 1 from auth.sessions s where s.user_id=p_user_id and s.id::text=auth.jwt()->>'session_id' and s.created_at>r.revoked_before))
$$;
create or replace function private.staff_session_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.staff_session_allowed_before_google(p_user_id) and not private.google_staff_session_blocked()
$$;
-- Preserve the existing function OIDs: RLS policies must keep calling the gate.
create function private.portal_account_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not exists(
  select 1 from private.portal_account_access a where a.user_id=auth.uid()
   and (not a.active or not exists(select 1 from auth.sessions s where s.user_id=a.user_id
    and s.id::text=auth.jwt()->>'session_id' and s.created_at>a.revoked_before))
 )
$$;
create or replace function public.portal_session_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select private.portal_account_allowed() and not private.google_registration_required() and not private.google_staff_session_blocked()
$$;

create function public.candidate_registration_status() returns text
language sql stable security definer set search_path='' as $$
 select case when not coalesce(private.portal_account_allowed(),false) or private.google_staff_session_blocked() then 'unavailable'
  when private.google_registration_required() then 'required' else 'complete' end
$$;

create function public.complete_google_registration(p_cpf text,p_birth_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare accepted integer;
begin
 if not coalesce(private.portal_account_allowed(),false)
  or exists(select 1 from public.staff where user_id=auth.uid())
  or not exists(select 1 from private.google_candidate_accounts where user_id=auth.uid())
  or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
  or not exists(select 1 from auth.identities where user_id=auth.uid() and provider='google' and identity_data->>'email_verified'='true')
 then raise exception 'permission_denied' using errcode='42501'; end if;
 -- Return validation failures, rather than raising, so attempts stay counted.
 insert into private.rate_limits(user_id,action,bucket,count)
 values(auth.uid(),'google_registration',date_trunc('hour',now()),1)
 on conflict(user_id,action,bucket) do update set count=private.rate_limits.count+1
 where private.rate_limits.count<10 returning count into accepted;
 if accepted is null then return jsonb_build_object('error','rate_limit'); end if;
 if not coalesce(private.valid_cpf(p_cpf),false) or p_birth_date is null or p_birth_date<'1900-01-01'
  or p_birth_date>(now() at time zone 'America/Sao_Paulo')::date then
  return jsonb_build_object('error','invalid_registration');
 end if;
 insert into private.candidate_registration(user_id,cpf,birth_date)
 values(auth.uid(),p_cpf,p_birth_date) on conflict(user_id) do nothing;
 return jsonb_build_object('ok',true);
end $$;

create function public.consume_google_oauth_quota(p_origin_key text) returns boolean
language plpgsql security definer set search_path='' as $$ declare accepted integer; begin
 if auth.role() is distinct from 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_origin_key is null or p_origin_key !~ '^[a-f0-9]{64}$' then return false; end if;
 delete from private.signup_limits where bucket<now()-interval '1 day';
 insert into private.signup_limits(key,bucket,count) values('google-start:'||p_origin_key,date_trunc('hour',now()),1)
 on conflict(key,bucket) do update set count=private.signup_limits.count+1 where private.signup_limits.count<30 returning count into accepted;
 if accepted is null then return false; end if;
 accepted:=null;
 insert into private.signup_limits(key,bucket,count) values('google-start-burst:'||p_origin_key,date_trunc('minute',now()),1)
 on conflict(key,bucket) do update set count=private.signup_limits.count+1 where private.signup_limits.count<10 returning count into accepted;
 return accepted is not null;
end $$;

create or replace function public.guard_candidate_signup(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ticket text:=event->'user'->'user_metadata'->>'registration_ticket'; origin text; accepted integer;
begin
 if event->'user'->'app_metadata'->>'provider'='azure' then return '{}'::jsonb; end if;
 if event->'user'->'app_metadata'->>'provider'='google'
  and event->'user'->'user_metadata'->>'email_verified'='true'
  and char_length(event->'user'->>'email')<=254
  and event->'user'->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  origin:=encode(extensions.digest('google-signup:'||coalesce(event->'metadata'->>'ip_address','shared-auth'),'sha256'),'hex');
  delete from private.signup_limits where bucket<now()-interval '1 day';
  insert into private.signup_limits(key,bucket,count) values(origin,date_trunc('hour',now()),1)
  on conflict(key,bucket) do update set count=private.signup_limits.count+1 where private.signup_limits.count<5 returning count into accepted;
  if accepted is null then return jsonb_build_object('error',jsonb_build_object('http_code',429,'message','Muitas tentativas de cadastro. Tente novamente mais tarde.')); end if;
  return '{}'::jsonb;
 end if;
 if event->'user'->'app_metadata'->>'provider'='email' and ticket ~ '^[a-f0-9]{64}$'
  and exists(select 1 from private.candidate_signup_tickets t
   where t.ticket_hash=encode(extensions.digest(ticket,'sha256'),'hex') and t.expires_at>now()
   and t.email=lower(event->'user'->>'email')) then return '{}'::jsonb; end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use o cadastro da plataforma Herbamed para criar sua conta.'));
end $$;

revoke all on function private.track_google_candidate(),private.google_registration_required(),private.google_staff_session_blocked(),
 private.staff_session_allowed_before_google(uuid),private.staff_session_allowed(uuid),private.portal_account_allowed(),
 public.portal_session_allowed(),public.candidate_registration_status(),public.complete_google_registration(text,date),
 public.consume_google_oauth_quota(text),public.guard_candidate_signup(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.portal_session_allowed() to authenticated;
grant execute on function public.candidate_registration_status(),public.complete_google_registration(text,date) to authenticated;
grant execute on function public.consume_google_oauth_quota(text) to service_role;
grant execute on function public.guard_candidate_signup(jsonb) to supabase_auth_admin;
