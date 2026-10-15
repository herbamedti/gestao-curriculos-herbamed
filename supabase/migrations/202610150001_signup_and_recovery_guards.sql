-- Account existence is server-only; the public action always acknowledges alike.
create function public.signup_email_exists(p_email text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
 return exists(select 1 from auth.users where lower(email)=lower(trim(p_email)) and deleted_at is null);
end $$;
revoke all on function public.signup_email_exists(text) from public,anon,authenticated;
grant execute on function public.signup_email_exists(text) to service_role;

-- A normal login must not authorize the password-recovery action. Only the
-- server, after consuming a recovery email token, can issue a short-lived grant.
create table private.password_recovery_grants (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users on delete cascade,
 session_id uuid not null,
 expires_at timestamptz not null default now()+interval '10 minutes'
);
alter table private.password_recovery_grants enable row level security;
create policy deny_direct_recovery_grants on private.password_recovery_grants
 for all to public using(false) with check(false);
revoke all on private.password_recovery_grants from public,anon,authenticated,service_role;

create function public.issue_password_recovery_grant(p_user_id uuid,p_session_id uuid,p_token_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
  or not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id)
 then raise exception 'invalid_recovery'; end if;
 delete from private.password_recovery_grants where expires_at<now() or user_id=p_user_id;
 insert into private.password_recovery_grants(token_hash,user_id,session_id) values(p_token_hash,p_user_id,p_session_id);
end $$;
revoke all on function public.issue_password_recovery_grant(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_password_recovery_grant(uuid,uuid,text) to service_role;

create function public.consume_password_recovery_grant(p_token_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare consumed text;
begin
 delete from private.password_recovery_grants where token_hash=p_token_hash
  and user_id=auth.uid() and session_id::text=auth.jwt()->>'session_id' and expires_at>now()
 returning token_hash into consumed;
 return consumed is not null;
end $$;
revoke all on function public.consume_password_recovery_grant(text) from public,anon,service_role;
grant execute on function public.consume_password_recovery_grant(text) to authenticated;
