-- Existing RLS/read policies and revoked domain table writes are preserved.
alter table public.job_questions add column kind text not null default 'text' check(kind in ('text','choice'));
alter table public.job_questions add column options text[] not null default '{}';

create function private.valid_question_options(p_kind text,p_options text[]) returns boolean
language sql immutable set search_path='' as $$
 select p_options is not null and (
   (p_kind='text' and cardinality(p_options)=0) or
   (p_kind='choice' and cardinality(p_options) between 2 and 30
    and not exists(select 1 from unnest(p_options) o where o is null or char_length(trim(o)) not between 1 and 200 or o<>trim(o))
    and (select count(distinct o) from unnest(p_options) o)=cardinality(p_options))
 );
$$;
revoke all on function private.valid_question_options(text,text[]) from public,anon,authenticated;
alter table public.job_questions add constraint valid_question_options check(private.valid_question_options(kind,options));

create function public.save_job_stages(p_job_id uuid,p_stages jsonb,p_expected jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare current_stages jsonb; item jsonb; stage_id uuid; stage_index integer:=0; begin
 perform private.require_permission('jobs.manage',p_job_id);
 perform 1 from public.jobs where id=p_job_id for update;
 if not found then raise exception 'job_unavailable'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'terminal',terminal) order by position),'[]') into current_stages from public.job_stages where job_id=p_job_id;
 if p_expected is distinct from current_stages then raise exception 'job_process_changed'; end if;
 if p_stages is null or jsonb_typeof(p_stages)<>'array' then raise exception 'invalid_stages'; end if;
 if jsonb_array_length(p_stages) not between 1 and 50 then raise exception 'invalid_stages'; end if;
 if p_stages->0->>'terminal' is distinct from 'false' then raise exception 'initial_stage_final'; end if;
 if exists(select 1 from jsonb_array_elements(p_stages) s where jsonb_typeof(s)<>'object' or s->>'id' is null or jsonb_typeof(s->'name') is distinct from 'string' or char_length(trim(s->>'name')) not between 2 and 100 or jsonb_typeof(s->'terminal') is distinct from 'boolean')
   or (select count(distinct (s->>'id')::uuid) from jsonb_array_elements(p_stages) s)<>jsonb_array_length(p_stages)
 then raise exception 'invalid_stages'; end if;
 if exists(select 1 from jsonb_array_elements(p_stages) s join public.job_stages st on st.id=(s->>'id')::uuid where st.job_id<>p_job_id) then raise exception 'invalid_stages'; end if;
 -- Never erase pipeline or event references, or reinterpret a used final stage.
 if exists(select 1 from public.job_stages st where st.job_id=p_job_id
   and (not exists(select 1 from jsonb_array_elements(p_stages) s where (s->>'id')::uuid=st.id)
     or exists(select 1 from jsonb_array_elements(p_stages) s where (s->>'id')::uuid=st.id and (s->>'terminal')::boolean<>st.terminal))
   and (exists(select 1 from public.applications a where a.stage_id=st.id)
     or exists(select 1 from public.application_events e where e.from_stage=st.id or e.to_stage=st.id))) then raise exception 'stage_in_use'; end if;
 delete from public.job_stages st where job_id=p_job_id and not exists(select 1 from jsonb_array_elements(p_stages) s where (s->>'id')::uuid=st.id);
 -- Move all positions out of the final range before assigning the new order;
 -- the existing immediate unique(job_id,position) constraint remains intact.
 update public.job_stages set position=position+(select coalesce(max(position),0)+51 from public.job_stages where job_id=p_job_id) where job_id=p_job_id;
 for item in select value from jsonb_array_elements(p_stages) loop
   stage_id=(item->>'id')::uuid;
   insert into public.job_stages(id,job_id,name,position,terminal) values(stage_id,p_job_id,trim(item->>'name'),stage_index,(item->>'terminal')::boolean)
   on conflict(id) do update set name=excluded.name,position=excluded.position,terminal=excluded.terminal where public.job_stages.job_id=p_job_id;
   if not found then raise exception 'invalid_stages'; end if;
   stage_index=stage_index+1;
 end loop;
end $$;
revoke all on function public.save_job_stages(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_job_stages(uuid,jsonb,jsonb) to authenticated;

create function public.save_job_question(p_job_id uuid,p_data jsonb,p_question_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare opts text[]; question public.job_questions; qid uuid; begin
 perform private.require_permission('jobs.manage',p_job_id);
 perform 1 from public.jobs where id=p_job_id for update;
 if not found then raise exception 'job_unavailable'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or jsonb_typeof(p_data->'label') is distinct from 'string'
   or char_length(trim(p_data->>'label')) not between 2 and 500
   or jsonb_typeof(p_data->'required') is distinct from 'boolean'
   or jsonb_typeof(p_data->'options') is distinct from 'array' then raise exception 'invalid_question'; end if;
 if exists(select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o)<>'string') then raise exception 'invalid_question'; end if;
 opts=array(select jsonb_array_elements_text(p_data->'options'));
 if p_data->>'kind' is null or not private.valid_question_options(p_data->>'kind',opts) then raise exception 'invalid_question'; end if;
 if p_question_id is not null then
   select * into question from public.job_questions where id=p_question_id and job_id=p_job_id;
   if not found then raise exception 'invalid_question'; end if;
   if exists(select 1 from public.application_answers where question_id=p_question_id)
     and (question.label is distinct from trim(p_data->>'label') or question.kind is distinct from p_data->>'kind' or question.options is distinct from opts)
   then raise exception 'question_in_use'; end if;
   update public.job_questions set label=trim(p_data->>'label'),kind=p_data->>'kind',options=opts,required=(p_data->>'required')::boolean where id=p_question_id;
   return p_question_id;
 end if;
 if (select count(*) from public.job_questions where job_id=p_job_id)>=50 then raise exception 'question_limit'; end if;
 insert into public.job_questions(job_id,label,kind,options,required,position)
 select p_job_id,trim(p_data->>'label'),p_data->>'kind',opts,(p_data->>'required')::boolean,coalesce(max(position),-1)+1 from public.job_questions where job_id=p_job_id returning id into qid;
 return qid;
end $$;
create function public.delete_job_question(p_job_id uuid,p_question_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('jobs.manage',p_job_id);
 perform 1 from public.jobs where id=p_job_id for update;
 if exists(select 1 from public.application_answers where question_id=p_question_id) then raise exception 'question_in_use'; end if;
 delete from public.job_questions where id=p_question_id and job_id=p_job_id;
 if not found then raise exception 'invalid_question'; end if;
end $$;
revoke all on function public.save_job_question(uuid,jsonb,uuid),public.delete_job_question(uuid,uuid) from public,anon;
grant execute on function public.save_job_question(uuid,jsonb,uuid),public.delete_job_question(uuid,uuid) to authenticated;

-- Compatibility for older deployments: text questions still use the validated RPC.
create or replace function public.add_job_item(p_job_id uuid,p_kind text,p_label text,p_required boolean default false) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('jobs.manage',p_job_id);
 perform 1 from public.jobs where id=p_job_id for update;
 if p_kind='stage' then
   if char_length(trim(p_label)) not between 2 and 100 or (select count(*) from public.job_stages where job_id=p_job_id)>=50 then raise exception 'invalid_stages'; end if;
   insert into public.job_stages(job_id,name,position) select p_job_id,trim(p_label),coalesce(max(position),-1)+1 from public.job_stages where job_id=p_job_id;
 elsif p_kind='question' then perform public.save_job_question(p_job_id,jsonb_build_object('label',p_label,'required',p_required,'kind','text','options','[]'::jsonb));
 else raise exception 'invalid_kind'; end if;
end $$;

create or replace function public.submit_application(p_job_id uuid,p_answers jsonb,p_policy_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; sid uuid; aid uuid; q record; answer text; begin
 perform private.rate_limit('application',20);
 perform 1 from public.jobs where id=p_job_id and status='published' and visibility='public'
   and (deadline is null or deadline>now()) for update;
 if not found then raise exception 'job_unavailable'; end if;
 select id into cid from public.candidates where user_id=auth.uid() and archived_at is null;
 if cid is null then raise exception 'complete_profile'; end if;
 if cardinality(public.curriculum_missing(cid))>0 then raise exception 'curriculum_incomplete'; end if;
 if not exists(select 1 from public.privacy_policies where id=p_policy_id and active and published_at<=now()) then raise exception 'invalid_policy'; end if;
 select id into sid from public.job_stages where job_id=p_job_id and not terminal order by position limit 1;
 if sid is null then raise exception 'invalid_stages'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then raise exception 'invalid_answer'; end if;
 if exists(select 1 from jsonb_each(p_answers) a where jsonb_typeof(a.value)<>'string' or not exists(select 1 from public.job_questions jq where jq.job_id=p_job_id and jq.id::text=a.key)) then raise exception 'invalid_answer'; end if;
 for q in select * from public.job_questions where job_id=p_job_id loop
   answer=coalesce(p_answers->>q.id::text,'');
   if char_length(answer)>4000 then raise exception 'invalid_answer'; end if;
   if q.required and length(trim(answer))=0 then raise exception 'answer_required'; end if;
   if q.kind='choice' and length(answer)>0 and not answer=any(q.options) then raise exception 'invalid_answer_option'; end if;
 end loop;
 insert into public.applications(candidate_id,job_id,stage_id,resume_id) values(cid,p_job_id,sid,null) returning id into aid;
 insert into public.application_answers(application_id,question_id,answer) select aid,id,coalesce(p_answers->>id::text,'') from public.job_questions where job_id=p_job_id;
 insert into public.policy_acknowledgements(candidate_id,policy_id,purpose,granted) values(cid,p_policy_id,'notice',true);
 insert into public.application_events(application_id,to_stage,actor_id) values(aid,sid,auth.uid());
 perform private.notify(auth.uid(),'Candidatura recebida','Sua candidatura foi recebida. Acompanhe as próximas etapas no portal.');
 return aid;
end $$;
