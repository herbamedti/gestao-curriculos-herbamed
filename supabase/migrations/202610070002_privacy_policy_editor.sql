-- Keep published content and acknowledgements immutable: revisions insert new rows.
-- No real notice or Storage bucket is provisioned by this migration.
create or replace function public.publish_privacy_policy(p_version text,p_title text,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare policy_id uuid;
begin
  perform private.require_permission('privacy.manage');
  if p_version is null or p_title is null or p_body is null
     or char_length(trim(p_version)) not between 2 and 40
     or char_length(trim(p_title)) not between 5 and 160
     or char_length(trim(p_body)) not between 100 and 100000 then
    raise exception 'invalid_policy_content';
  end if;
  -- Serialize publications, including the version check and active-row switch.
  perform pg_catalog.pg_advisory_xact_lock(726350);
  if exists(select 1 from public.privacy_policies where version=trim(p_version)) then
    raise exception 'policy_version_exists';
  end if;
  update public.privacy_policies set active=false where active;
  insert into public.privacy_policies(version,title,body,published_at,active)
  values(trim(p_version),trim(p_title),trim(p_body),now(),true)
  returning id into policy_id;
  return policy_id;
end $$;

-- Existing explicit RLS policies and lack of direct writes remain in force.
revoke all on function public.publish_privacy_policy(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.publish_privacy_policy(text,text,text) to authenticated;
