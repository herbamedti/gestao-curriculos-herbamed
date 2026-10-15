-- Internal membership comes from the domain table, never email, user metadata
-- or a profile/next query parameter. Classification fails closed.
create function public.account_area() returns text
language plpgsql stable security definer set search_path='' as $$
declare account public.staff%rowtype;
begin
 if auth.uid() is null or public.candidate_registration_status()<>'complete' then return 'unavailable'; end if;
 select * into account from public.staff where user_id=auth.uid();
 if found then
  if not public.is_staff() then return 'unavailable'; end if;
  if (account.mfa_enabled or exists(select 1 from private.primary_administrator where user_id=auth.uid()))
   and coalesce(auth.jwt()->>'aal','')<>'aal2' then return 'staff_mfa'; end if;
  return 'staff';
 end if;
 return 'candidate';
end $$;
revoke all on function public.account_area() from public,anon,service_role;
grant execute on function public.account_area() to authenticated;

create function private.require_candidate_account() returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_portal_session();
 if auth.uid() is null or exists(select 1 from public.staff where user_id=auth.uid())
 then raise exception 'permission_denied' using errcode='42501'; end if;
end $$;
revoke all on function private.require_candidate_account() from public,anon,authenticated,service_role;

-- Owning a historical curriculum must not grant internal users candidate powers.
-- Existing RH permissions to manage candidates remain independent and intact.
create or replace function public.owns_candidate(p_candidate_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.portal_session_allowed()
  and not exists(select 1 from public.staff where user_id=auth.uid())
  and exists(select 1 from public.candidates where id=p_candidate_id and user_id=auth.uid() and archived_at is null)
$$;

alter function public.save_candidate(jsonb,uuid) rename to save_candidate_before_area_guard;
alter function public.save_candidate_before_area_guard(jsonb,uuid) set schema private;
create function public.save_candidate(p_data jsonb,p_candidate_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 if p_candidate_id is null then perform private.require_candidate_account(); end if;
 return private.save_candidate_before_area_guard(p_data,p_candidate_id);
end $$;

alter function public.save_privacy(uuid,boolean) rename to save_privacy_before_area_guard;
alter function public.save_privacy_before_area_guard(uuid,boolean) set schema private;
create function public.save_privacy(p_policy_id uuid,p_talent_pool boolean) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform private.require_candidate_account();
 perform private.save_privacy_before_area_guard(p_policy_id,p_talent_pool);
end $$;

alter function public.submit_application(uuid,jsonb,uuid) rename to submit_application_before_area_guard;
alter function public.submit_application_before_area_guard(uuid,jsonb,uuid) set schema private;
create function public.submit_application(p_job_id uuid,p_answers jsonb,p_policy_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 perform private.require_candidate_account();
 return private.submit_application_before_area_guard(p_job_id,p_answers,p_policy_id);
end $$;

alter function public.withdraw_application(uuid) rename to withdraw_application_before_area_guard;
alter function public.withdraw_application_before_area_guard(uuid) set schema private;
create function public.withdraw_application(p_application_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform private.require_candidate_account();
 perform private.withdraw_application_before_area_guard(p_application_id);
end $$;

revoke all on function private.save_candidate_before_area_guard(jsonb,uuid),private.save_privacy_before_area_guard(uuid,boolean),
 private.submit_application_before_area_guard(uuid,jsonb,uuid),private.withdraw_application_before_area_guard(uuid),
 public.save_candidate(jsonb,uuid),public.save_privacy(uuid,boolean),public.submit_application(uuid,jsonb,uuid),public.withdraw_application(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.save_candidate(jsonb,uuid),public.save_privacy(uuid,boolean),
 public.submit_application(uuid,jsonb,uuid),public.withdraw_application(uuid) to authenticated;
notify pgrst,'reload schema';
