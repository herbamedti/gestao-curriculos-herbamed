-- Staff may maintain a complete structured curriculum. Existing portal-owned
-- identities keep their login email; manual profiles may have their email edited.
create or replace function public.create_manual_candidate(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; aid text; lim integer; begin
 perform private.require_permission('candidates.create');
 perform private.rate_limit('manual_candidate',30);
 if length(trim(coalesce(p_data->>'full_name',''))) not between 2 and 160
   or length(trim(coalesce(p_data->>'email','')))<3 then raise exception 'invalid_candidate'; end if;
 if length(trim(coalesce(p_data->>'source','')))<3
   or length(trim(coalesce(p_data->>'processing_purpose','')))<3
   or length(trim(coalesce(p_data->>'legal_basis','')))<3 then raise exception 'purpose_required'; end if;
 lim=coalesce((select (value::text)::integer from public.settings where key='max_interest_areas'),3);
 if jsonb_array_length(coalesce(p_data->'interests','[]'::jsonb))>lim then raise exception 'too_many_interests'; end if;
 insert into public.candidates(full_name,email,phone,city,state,headline,summary,skills,availability,work_model,professional_url,source,processing_purpose,legal_basis,created_by)
 values(trim(p_data->>'full_name'),lower(trim(p_data->>'email')),left(coalesce(p_data->>'phone',''),30),left(coalesce(p_data->>'city',''),100),left(coalesce(p_data->>'state',''),2),left(coalesce(p_data->>'headline',''),160),left(coalesce(p_data->>'summary',''),4000),
   array(select jsonb_array_elements_text(coalesce(p_data->'skills','[]'::jsonb)) limit 30),left(coalesce(p_data->>'availability',''),100),left(coalesce(p_data->>'work_model',''),30),left(coalesce(p_data->>'professional_url',''),500),
   left(p_data->>'source',100),left(p_data->>'processing_purpose',200),left(p_data->>'legal_basis',200),auth.uid()) returning id into cid;
 for aid in select jsonb_array_elements_text(coalesce(p_data->'interests','[]'::jsonb)) loop
   insert into public.candidate_interests(candidate_id,area_id)
   select cid,id from public.interest_areas where id=aid::uuid and active on conflict do nothing;
 end loop;
 return cid;
end $$;

create function public.manage_candidate_curriculum(p_candidate_id uuid,p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare candidate public.candidates; aid text; lim integer; new_email text; begin
 if not public.is_staff() or not public.can_candidate(p_candidate_id,'candidates.edit')
 then raise exception 'permission_denied' using errcode='42501'; end if;
 perform private.rate_limit('staff_curriculum',100);
 select * into candidate from public.candidates where id=p_candidate_id and archived_at is null for update;
 if candidate.id is null then raise exception 'candidate_not_found'; end if;
 new_email=lower(trim(coalesce(p_data->>'email','')));
 if length(trim(coalesce(p_data->>'full_name',''))) not between 2 and 160 or length(new_email)<3
 then raise exception 'invalid_candidate'; end if;
 if candidate.user_id is not null and new_email<>lower(candidate.email)
 then raise exception 'login_email_locked'; end if;
 if candidate.user_id is null and (length(trim(coalesce(p_data->>'source','')))<3
   or length(trim(coalesce(p_data->>'processing_purpose','')))<3
   or length(trim(coalesce(p_data->>'legal_basis','')))<3)
 then raise exception 'purpose_required'; end if;
 lim=coalesce((select (value::text)::integer from public.settings where key='max_interest_areas'),3);
 if jsonb_array_length(coalesce(p_data->'interests','[]'::jsonb))>lim then raise exception 'too_many_interests'; end if;
 update public.candidates set full_name=trim(p_data->>'full_name'),email=new_email,
   phone=left(coalesce(p_data->>'phone',''),30),city=left(coalesce(p_data->>'city',''),100),state=left(coalesce(p_data->>'state',''),2),
   headline=left(coalesce(p_data->>'headline',''),160),summary=left(coalesce(p_data->>'summary',''),4000),
   skills=array(select jsonb_array_elements_text(coalesce(p_data->'skills','[]'::jsonb)) limit 30),
   availability=left(coalesce(p_data->>'availability',''),100),work_model=left(coalesce(p_data->>'work_model',''),30),
   professional_url=left(coalesce(p_data->>'professional_url',''),500),
   source=case when candidate.user_id is null then left(p_data->>'source',100) else source end,
   processing_purpose=case when candidate.user_id is null then left(p_data->>'processing_purpose',200) else processing_purpose end,
   legal_basis=case when candidate.user_id is null then left(p_data->>'legal_basis',200) else legal_basis end
 where id=p_candidate_id;
 delete from public.candidate_interests where candidate_id=p_candidate_id;
 for aid in select jsonb_array_elements_text(coalesce(p_data->'interests','[]'::jsonb)) loop
   insert into public.candidate_interests(candidate_id,area_id)
   select p_candidate_id,id from public.interest_areas where id=aid::uuid and active on conflict do nothing;
 end loop;
end $$;

insert into public.permissions(code,label) values('applications.link','Vincular candidato a vaga') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission)
select id,'applications.link' from public.roles where name in ('Superadministrador','Administrador RH','Recrutador')
on conflict do nothing;

create function public.link_candidate_to_job(p_candidate_id uuid,p_job_id uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; sid uuid; aid uuid; candidate_user uuid; begin
 perform private.require_permission('applications.link',p_job_id);
 perform private.rate_limit('staff_application',50);
 if length(trim(coalesce(p_note,'')))<3 or length(p_note)>2000 then raise exception 'link_reason_required'; end if;
 select id,user_id into cid,candidate_user from public.candidates where id=p_candidate_id and archived_at is null for update;
 if cid is null or not public.can_candidate(cid,'candidates.read') then raise exception 'permission_denied' using errcode='42501'; end if;
 if cardinality(public.curriculum_missing(cid))>0 then raise exception 'curriculum_incomplete'; end if;
 perform 1 from public.jobs where id=p_job_id and status='published' and visibility='public'
   and (deadline is null or deadline>now()) for update;
 if not found then raise exception 'job_unavailable'; end if;
 if exists(select 1 from public.applications where candidate_id=cid and job_id=p_job_id) then raise exception 'already_linked'; end if;
 select id into sid from public.job_stages where job_id=p_job_id order by position limit 1;
 if sid is null then raise exception 'job_stage_missing'; end if;
 insert into public.applications(candidate_id,job_id,stage_id,resume_id)
 values(cid,p_job_id,sid,null) returning id into aid;
 insert into public.application_events(application_id,to_stage,actor_id,note)
 values(aid,sid,auth.uid(),'Vinculação pelo RH: '||trim(p_note));
 if candidate_user is not null then
   perform private.notify(candidate_user,'Nova candidatura vinculada','A equipe de recrutamento vinculou seu perfil a uma vaga. Confira os detalhes no portal.');
 end if;
 return aid;
end $$;
revoke all on function public.manage_candidate_curriculum(uuid,jsonb),public.link_candidate_to_job(uuid,uuid,text) from public,anon;
grant execute on function public.manage_candidate_curriculum(uuid,jsonb),public.link_candidate_to_job(uuid,uuid,text) to authenticated;
