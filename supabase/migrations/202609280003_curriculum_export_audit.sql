create function public.authorize_curriculum_export(p_candidate_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.candidates where id=p_candidate_id and archived_at is null) or
   (not public.owns_candidate(p_candidate_id) and not public.can_candidate(p_candidate_id,'candidates.read'))
 then raise exception 'permission_denied' using errcode='42501'; end if;
 insert into public.audit_events(actor_id,action,resource,resource_id)
 values(auth.uid(),'export','curriculum',p_candidate_id::text);
end $$;
revoke all on function public.authorize_curriculum_export(uuid) from public,anon;
grant execute on function public.authorize_curriculum_export(uuid) to authenticated;
