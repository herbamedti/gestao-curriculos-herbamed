-- Issuance uses the Supabase Data API so serverless deployments do not need
-- direct PostgreSQL connections. Only the backend's secret API key may call it.
create function public.issue_account_email_code(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  code text := upper(encode(extensions.gen_random_bytes(5),'hex'));
  address text;
  issued uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
  select email into address from auth.users
  where id=p_user_id and email_confirmed_at is not null;
  if address is null then return null; end if;
  insert into private.account_email_challenges(user_id,code_hash,expires_at,recipient_email)
  values(p_user_id,encode(extensions.digest(code,'sha256'),'hex'),now()+interval '10 minutes',address)
  on conflict(user_id) do update set
    code_hash=excluded.code_hash,
    expires_at=excluded.expires_at,
    recipient_email=excluded.recipient_email,
    issued_at=now(),
    attempts=0,
    window_started_at=case when private.account_email_challenges.window_started_at < now()-interval '1 hour'
      then now() else private.account_email_challenges.window_started_at end,
    sends_in_window=case when private.account_email_challenges.window_started_at < now()-interval '1 hour'
      then 1 else private.account_email_challenges.sends_in_window+1 end
  where private.account_email_challenges.issued_at < now()-interval '60 seconds'
    and (private.account_email_challenges.window_started_at < now()-interval '1 hour'
      or private.account_email_challenges.sends_in_window < 5)
  returning user_id into issued;
  if issued is null then return null; end if;
  return jsonb_build_object('code',code,'email',address);
end $$;

create function public.revoke_account_email_code(p_user_id uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'permission_denied' using errcode='42501'; end if;
  delete from private.account_email_challenges
  where user_id=p_user_id and code_hash=encode(extensions.digest(p_code,'sha256'),'hex');
end $$;

-- Run once from the Supabase SQL Editor after a verified Entra sign-in.
-- No Data API role may execute this function.
create function private.bootstrap_first_staff(p_email text,p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; admin_role uuid;
begin
  if exists(select 1 from public.staff) then raise exception 'staff_already_exists'; end if;
  if char_length(trim(p_display_name)) not between 2 and 160 then raise exception 'invalid_name'; end if;
  select id into target from auth.users
  where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null
    and raw_app_meta_data->>'provider'='azure';
  if target is null then raise exception 'verified_azure_user_required'; end if;
  select id into admin_role from public.roles where name='Superadministrador' and active;
  if admin_role is null then raise exception 'admin_role_missing'; end if;
  insert into public.staff(user_id,display_name) values(target,trim(p_display_name));
  insert into public.staff_roles(user_id,role_id) values(target,admin_role);
  return target;
end $$;

-- Real text is supplied by an authorized RH user; no local demo notice is
-- copied to the hosted database.
create function public.publish_privacy_policy(p_version text,p_title text,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare policy_id uuid;
begin
  perform private.require_permission('privacy.manage');
  if char_length(trim(p_version)) not between 2 and 40
     or char_length(trim(p_title)) not between 5 and 160
     or char_length(trim(p_body)) not between 100 and 20000 then
    raise exception 'invalid_policy';
  end if;
  update public.privacy_policies set active=false where active;
  insert into public.privacy_policies(version,title,body,published_at,active)
  values(trim(p_version),trim(p_title),trim(p_body),now(),true)
  returning id into policy_id;
  return policy_id;
end $$;

revoke all on function public.issue_account_email_code(uuid),
 public.revoke_account_email_code(uuid,text),
 private.bootstrap_first_staff(text,text),
 public.publish_privacy_policy(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.issue_account_email_code(uuid),
 public.revoke_account_email_code(uuid,text) to service_role;
grant execute on function public.publish_privacy_policy(text,text,text) to authenticated;
