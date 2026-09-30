-- The application can be submitted after the resume upload completes. Access to
-- the document remains restricted until the existing scanner marks it clean.
create or replace function public.submit_application(p_job_id uuid,p_answers jsonb,p_policy_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; sid uuid; resume public.documents; aid uuid; q record; begin
 perform private.rate_limit('application',20);
 perform 1 from public.jobs where id=p_job_id and status='published' and visibility='public' and (deadline is null or deadline>now()) for update;
 if not found then raise exception 'job_unavailable'; end if;
 select id into cid from public.candidates where user_id=auth.uid() and archived_at is null and city<>'';
 if cid is null then raise exception 'complete_profile'; end if;
 if not exists(select 1 from public.privacy_policies where id=p_policy_id and active and published_at<=now()) then raise exception 'invalid_policy'; end if;
 select id into sid from public.job_stages where job_id=p_job_id order by position limit 1;
 select * into resume from public.documents where candidate_id=cid and kind='resume' order by created_at desc,id desc limit 1;
 if resume.id is null then raise exception 'resume_required'; end if;
 if resume.status not in ('pending','scanning','clean') then raise exception 'resume_unavailable'; end if;
 if resume.status<>'clean' and not exists(select 1 from storage.objects where bucket_id='quarantine' and name=resume.object_path) then
   raise exception 'resume_upload_incomplete';
 end if;
 for q in select * from public.job_questions where job_id=p_job_id loop
   if q.required and length(trim(coalesce(p_answers->>q.id::text,'')))=0 then raise exception 'answer_required'; end if;
 end loop;
 insert into public.applications(candidate_id,job_id,stage_id,resume_id) values(cid,p_job_id,sid,resume.id) returning id into aid;
 insert into public.application_answers(application_id,question_id,answer) select aid,id,coalesce(p_answers->>id::text,'') from public.job_questions where job_id=p_job_id;
 insert into public.policy_acknowledgements(candidate_id,policy_id,purpose,granted) values(cid,p_policy_id,'notice',true);
 insert into public.application_events(application_id,to_stage,actor_id) values(aid,sid,auth.uid());
 perform private.notify(auth.uid(),'Candidatura recebida','Sua candidatura foi recebida. Acompanhe as próximas etapas no portal.');
 return aid;
end $$;
