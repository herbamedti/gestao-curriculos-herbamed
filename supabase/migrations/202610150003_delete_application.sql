-- Permanent deletion is exclusive to the designated primary administrator at
-- AAL2. A generic Superadministrator role or a UI permission is not sufficient.
create function public.delete_application(p_application_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare application public.applications;
begin
 perform private.require_primary_administrator();
 perform private.rate_limit('application_delete',30);
 select * into application from public.applications where id=p_application_id for update;
 if application.id is null or p_expected_updated_at is null or application.updated_at is distinct from p_expected_updated_at
 then raise exception 'application_changed'; end if;

 -- Delete only process-specific records. Profile, Auth account, documents,
 -- messages, other applications and the immutable audit trail are preserved.
 -- All deletes and their existing audit triggers commit atomically.
 delete from public.interviews where application_id=application.id;
 delete from public.evaluations where application_id=application.id;
 delete from public.application_answers where application_id=application.id;
 delete from public.application_events where application_id=application.id;
 delete from public.applications where id=application.id;
end $$;
revoke all on function public.delete_application(uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.delete_application(uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
