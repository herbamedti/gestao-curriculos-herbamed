-- The existing Before User Created hook also protects internal invitations.
-- A server reservation authorizes account creation, never internal privileges.
create table private.staff_invitation_tickets (
 ticket_hash text primary key check(ticket_hash ~ '^[a-f0-9]{64}$'),
 email text not null check(char_length(email)<=254),
 expires_at timestamptz not null default now()+interval '10 minutes'
);
alter table private.staff_invitation_tickets enable row level security;
create policy deny_direct_staff_tickets on private.staff_invitation_tickets for all to public using(false) with check(false);
revoke all on private.staff_invitation_tickets from public,anon,authenticated,service_role,supabase_auth_admin;
create function public.prepare_staff_invitation(p_actor_id uuid,p_email text,p_ticket_hash text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from private.primary_administrator p join public.staff s on s.user_id=p.user_id where p.user_id=p_actor_id and s.active)
 then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_email is null or char_length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or p_ticket_hash is null or p_ticket_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_invitation'; end if;
 if exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then raise exception 'account_exists'; end if;
 delete from private.staff_invitation_tickets where expires_at<now();
 insert into private.staff_invitation_tickets(ticket_hash,email) values(p_ticket_hash,lower(trim(p_email)));
end $$;
-- Keep the Auth hook's public name and ACL. The previous implementation retains
-- its candidate ticket, verified Google email and signup quotas unchanged.
alter function public.guard_candidate_signup(jsonb) rename to guard_candidate_signup_before_staff;
alter function public.guard_candidate_signup_before_staff(jsonb) set schema private;
create function public.guard_candidate_signup(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ticket text:=event->'user'->'user_metadata'->>'staff_invitation_ticket'; accepted integer;
begin
 if ticket is not null then
  if event->'user'->'app_metadata'->>'provider'='email' and ticket ~ '^[a-f0-9]{64}$' then
   delete from private.staff_invitation_tickets where ticket_hash=encode(extensions.digest(ticket,'sha256'),'hex')
    and email=lower(event->'user'->>'email') and expires_at>now();
   get diagnostics accepted=row_count;
   if accepted=1 then return '{}'::jsonb; end if;
  end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','O convite não está autorizado. Solicite um novo convite ao administrador.'));
 end if;
 return private.guard_candidate_signup_before_staff(event);
end $$;
create or replace function public.candidate_registration_status() returns text
language sql stable security definer set search_path='' as $$
 select case when not coalesce(private.portal_account_allowed(),false) or private.google_staff_session_blocked()
  or exists(select 1 from public.staff s where s.user_id=auth.uid() and (not s.active or not private.staff_session_allowed_before_google(s.user_id))) then 'unavailable'
  when not private.staff_setup_complete(auth.uid()) then 'password_required'
  when not private.internal_account_allowed() then 'unavailable'
  when private.google_registration_required() then 'required' else 'complete' end
$$;
revoke all on function public.prepare_staff_invitation(uuid,text,text),public.guard_candidate_signup(jsonb),private.guard_candidate_signup_before_staff(jsonb) from public,anon,authenticated,service_role,supabase_auth_admin;
grant execute on function public.prepare_staff_invitation(uuid,text,text) to service_role;
grant execute on function public.guard_candidate_signup(jsonb) to supabase_auth_admin;
