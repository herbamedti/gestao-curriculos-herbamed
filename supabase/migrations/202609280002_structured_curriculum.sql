-- Keep the historical documents and Storage tables intact. New applications use
-- the structured candidate profile and do not create or require uploaded files.
create or replace function public.curriculum_missing(p_candidate_id uuid) returns text[]
language plpgsql stable security definer set search_path='' as $$
declare candidate public.candidates; missing text[] := '{}'; begin
 if not public.owns_candidate(p_candidate_id) and not public.can_candidate(p_candidate_id,'candidates.read') then
   raise exception 'permission_denied' using errcode='42501';
 end if;
 select * into candidate from public.candidates where id=p_candidate_id and archived_at is null;
 if candidate.id is null then raise exception 'candidate_not_found'; end if;
 if length(trim(candidate.full_name))<2 then missing:=array_append(missing,'full_name'); end if;
 if length(trim(candidate.email))=0 then missing:=array_append(missing,'email'); end if;
 if length(regexp_replace(candidate.phone,'[^0-9]','','g'))<10 then missing:=array_append(missing,'phone'); end if;
 if length(trim(candidate.city))<2 then missing:=array_append(missing,'city'); end if;
 if length(trim(candidate.headline))<3 then missing:=array_append(missing,'headline'); end if;
 if length(trim(candidate.summary))<30 then missing:=array_append(missing,'summary'); end if;
 if coalesce(array_length(candidate.skills,1),0)=0 then missing:=array_append(missing,'skills'); end if;
 if not exists(select 1 from public.profile_entries e where e.candidate_id=p_candidate_id
   and e.kind in ('experience','education') and length(trim(e.title))>=2 and length(trim(e.organization))>=2)
 then missing:=array_append(missing,'trajectory'); end if;
 return missing;
end $$;
revoke all on function public.curriculum_missing(uuid) from public,anon;
grant execute on function public.curriculum_missing(uuid) to authenticated;

create or replace function public.submit_application(p_job_id uuid,p_answers jsonb,p_policy_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; sid uuid; aid uuid; q record; begin
 perform private.rate_limit('application',20);
 perform 1 from public.jobs where id=p_job_id and status='published' and visibility='public'
   and (deadline is null or deadline>now()) for update;
 if not found then raise exception 'job_unavailable'; end if;
 select id into cid from public.candidates where user_id=auth.uid() and archived_at is null;
 if cid is null then raise exception 'complete_profile'; end if;
 if cardinality(public.curriculum_missing(cid))>0 then raise exception 'curriculum_incomplete'; end if;
 if not exists(select 1 from public.privacy_policies where id=p_policy_id and active and published_at<=now())
 then raise exception 'invalid_policy'; end if;
 select id into sid from public.job_stages where job_id=p_job_id order by position limit 1;
 for q in select * from public.job_questions where job_id=p_job_id loop
   if q.required and length(trim(coalesce(p_answers->>q.id::text,'')))=0 then raise exception 'answer_required'; end if;
 end loop;
 insert into public.applications(candidate_id,job_id,stage_id,resume_id)
 values(cid,p_job_id,sid,null) returning id into aid;
 insert into public.application_answers(application_id,question_id,answer)
 select aid,id,coalesce(p_answers->>id::text,'') from public.job_questions where job_id=p_job_id;
 insert into public.policy_acknowledgements(candidate_id,policy_id,purpose,granted)
 values(cid,p_policy_id,'notice',true);
 insert into public.application_events(application_id,to_stage,actor_id) values(aid,sid,auth.uid());
 perform private.notify(auth.uid(),'Candidatura recebida','Sua candidatura foi recebida. Acompanhe as próximas etapas no portal.');
 return aid;
end $$;

-- Existing entries remain editable without granting direct table writes.
create or replace function public.update_profile_entry(p_candidate_id uuid,p_entry_id uuid,p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not public.owns_candidate(p_candidate_id) and not public.can_candidate(p_candidate_id,'candidates.edit')
 then raise exception 'permission_denied' using errcode='42501'; end if;
 perform private.rate_limit('profile_entry',100);
 update public.profile_entries set
   kind=p_data->>'kind',title=p_data->>'title',organization=coalesce(p_data->>'organization',''),
   start_date=nullif(p_data->>'start_date','')::date,end_date=nullif(p_data->>'end_date','')::date,
   description=coalesce(p_data->>'description','')
 where id=p_entry_id and candidate_id=p_candidate_id;
 if not found then raise exception 'entry_not_found'; end if;
end $$;
revoke all on function public.update_profile_entry(uuid,uuid,jsonb) from public,anon;
grant execute on function public.update_profile_entry(uuid,uuid,jsonb) to authenticated;
