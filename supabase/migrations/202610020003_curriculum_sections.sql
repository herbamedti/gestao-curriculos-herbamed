-- Optional competencies and initial trajectory cards, saved atomically by authorized RPCs.
alter function private.candidate_details(jsonb) rename to candidate_details_base;
create function private.candidate_details(p_data jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare item jsonb; begin
 perform private.candidate_details_base(p_data-'personal_competencies');
 if p_data ? 'personal_competencies' then
  if jsonb_typeof(p_data->'personal_competencies') is distinct from 'array' then raise exception 'invalid_candidate_details'; end if;
  if jsonb_array_length(p_data->'personal_competencies')>30 then raise exception 'invalid_candidate_details'; end if;
  for item in select jsonb_array_elements(p_data->'personal_competencies') loop
   if jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 1 and 100 then raise exception 'invalid_candidate_details'; end if;
  end loop;
 end if;
 return p_data;
end $$;

-- Only called immediately after an authorized new candidate creation, never exposed via PostgREST.
create function private.insert_initial_entries(p_candidate_id uuid,p_entries jsonb) returns void
language plpgsql set search_path='' as $$
declare item jsonb; field text; eid uuid; begin
 if jsonb_typeof(p_entries) is distinct from 'array' then raise exception 'invalid_initial_entries'; end if;
 if jsonb_array_length(p_entries)>50 then raise exception 'invalid_initial_entries'; end if;
 if jsonb_array_length(p_entries)>0 then perform private.rate_limit('initial_entries',30); end if;
 for item in select jsonb_array_elements(p_entries) loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'invalid_initial_entries'; end if;
  foreach field in array array['kind','title','organization','start_date','end_date','description','level','status','period_text'] loop
   if item ? field and jsonb_typeof(item->field)<>'string' then raise exception 'invalid_initial_entries'; end if;
  end loop;
  if coalesce(item->>'kind','') not in ('experience','education','course','certification','language')
   or length(trim(coalesce(item->>'title',''))) not between 2 and 160
   or length(trim(coalesce(item->>'organization','')))>160
   or (item->>'kind'<>'language' and length(trim(coalesce(item->>'organization','')))<2)
   or length(coalesce(item->>'description',''))>10000
   or coalesce(item->>'start_date','') !~ '^$|^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or coalesce(item->>'end_date','') !~ '^$|^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   then raise exception 'invalid_initial_entries'; end if;
  insert into public.profile_entries(candidate_id,kind,title,organization,start_date,end_date,description)
   values(p_candidate_id,item->>'kind',trim(item->>'title'),trim(coalesce(item->>'organization','')),nullif(item->>'start_date','')::date,nullif(item->>'end_date','')::date,coalesce(item->>'description','')) returning id into eid;
  perform private.entry_details(eid,item);
 end loop;
end $$;

create or replace function public.save_candidate(p_data jsonb,p_candidate_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare cid uuid; entries jsonb:=coalesce(p_data->'initial_entries','[]'::jsonb); begin
 if jsonb_typeof(entries) is distinct from 'array' then raise exception 'invalid_initial_entries'; end if;
 if jsonb_array_length(entries)>0 then
  -- Serializes initial saves per account, preventing duplicate trajectory on retries/concurrent tabs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(auth.uid()::text,''),731));
  if p_candidate_id is not null or exists(select 1 from public.candidates where user_id=auth.uid()) then raise exception 'initial_profile_exists'; end if;
 end if;
 cid:=private.save_candidate_base(p_data,p_candidate_id);
 if p_data ? 'additional_info' then update public.candidates set additional_info=additional_info || private.candidate_details(p_data->'additional_info') where id=cid; end if;
 perform private.insert_initial_entries(cid,entries);
 return cid;
end $$;
create or replace function public.create_manual_candidate(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$ declare cid uuid; begin
 cid:=private.create_manual_candidate_base(p_data);
 if p_data ? 'additional_info' then update public.candidates set additional_info=additional_info || private.candidate_details(p_data->'additional_info') where id=cid; end if;
 perform private.insert_initial_entries(cid,coalesce(p_data->'initial_entries','[]'::jsonb));
 return cid;
end $$;
create or replace function public.manage_candidate_curriculum(p_candidate_id uuid,p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform private.manage_candidate_curriculum_base(p_candidate_id,p_data);
 if p_data ? 'additional_info' then update public.candidates set additional_info=additional_info || private.candidate_details(p_data->'additional_info') where id=p_candidate_id; end if;
end $$;
revoke all on function private.candidate_details(jsonb),private.candidate_details_base(jsonb),private.insert_initial_entries(uuid,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
