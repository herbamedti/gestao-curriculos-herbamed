-- Keep existing RPC authorization/rate limits and add optional curriculum data.
alter table public.candidates add column additional_info jsonb not null default '{}'::jsonb check(jsonb_typeof(additional_info)='object');
alter table public.profile_entries
 add column level text not null default '' check(length(level)<=100),
 add column status text not null default '' check(status in ('','Atual','Em andamento','Concluído','Interrompido')),
 add column period_text text not null default '' check(length(period_text)<=100),
 add column duration_hours integer check(duration_hours between 1 and 100000);

create function private.candidate_details(p_data jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare details jsonb := p_data; key text; begin
 if jsonb_typeof(details) is distinct from 'object' then raise exception 'invalid_candidate_details'; end if;
 for key in select jsonb_object_keys(details) loop
  if key not in ('secondary_phone','neighborhood','driver_license','portfolio_url','travel_available','relocation_available') then raise exception 'invalid_candidate_details'; end if;
 end loop;
 foreach key in array array['secondary_phone','neighborhood','driver_license','portfolio_url'] loop
  if details ? key and jsonb_typeof(details->key)<>'string' then raise exception 'invalid_candidate_details'; end if;
 end loop;
 if length(coalesce(details->>'secondary_phone',''))>30 or length(coalesce(details->>'neighborhood',''))>100
   or length(coalesce(details->>'portfolio_url',''))>500
   or (coalesce(details->>'portfolio_url','')<>'' and details->>'portfolio_url' !~ '^https://[^[:space:]]+$')
   or coalesce(details->>'driver_license','') not in ('','A','B','AB','C','AC','D','AD','E','AE') then raise exception 'invalid_candidate_details'; end if;
 foreach key in array array['travel_available','relocation_available'] loop
  if details ? key and jsonb_typeof(details->key)<>'boolean' then raise exception 'invalid_candidate_details'; end if;
 end loop;
 return details;
end $$;

alter function public.save_candidate(jsonb,uuid) rename to save_candidate_base;
alter function public.save_candidate_base(jsonb,uuid) set schema private;
alter function public.create_manual_candidate(jsonb) rename to create_manual_candidate_base;
alter function public.create_manual_candidate_base(jsonb) set schema private;
alter function public.manage_candidate_curriculum(uuid,jsonb) rename to manage_candidate_curriculum_base;
alter function public.manage_candidate_curriculum_base(uuid,jsonb) set schema private;

create function public.save_candidate(p_data jsonb,p_candidate_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare cid uuid; begin
 cid:=private.save_candidate_base(p_data,p_candidate_id);
 if p_data ? 'additional_info' then update public.candidates set additional_info=private.candidate_details(p_data->'additional_info') where id=cid; end if;
 return cid;
end $$;
create function public.create_manual_candidate(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$ declare cid uuid; begin
 cid:=private.create_manual_candidate_base(p_data);
 if p_data ? 'additional_info' then update public.candidates set additional_info=private.candidate_details(p_data->'additional_info') where id=cid; end if;
 return cid;
end $$;
create function public.manage_candidate_curriculum(p_candidate_id uuid,p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform private.manage_candidate_curriculum_base(p_candidate_id,p_data);
 if p_data ? 'additional_info' then update public.candidates set additional_info=private.candidate_details(p_data->'additional_info') where id=p_candidate_id; end if;
end $$;

create function private.entry_details(p_entry_id uuid,p_data jsonb) returns void
language plpgsql set search_path='' as $$ begin
 if coalesce(p_data->>'status','') in ('Atual','Em andamento') and coalesce(p_data->>'end_date','')<>'' then raise exception 'invalid_entry_dates'; end if;
 update public.profile_entries set level=coalesce(p_data->>'level',level),status=coalesce(p_data->>'status',status),
  period_text=coalesce(p_data->>'period_text',period_text),duration_hours=case when p_data ? 'duration_hours' then nullif(p_data->>'duration_hours','')::integer else duration_hours end
 where id=p_entry_id;
end $$;
alter function public.save_profile_entry(uuid,jsonb,uuid) rename to save_profile_entry_base;
alter function public.save_profile_entry_base(uuid,jsonb,uuid) set schema private;
alter function public.update_profile_entry(uuid,uuid,jsonb) rename to update_profile_entry_base;
alter function public.update_profile_entry_base(uuid,uuid,jsonb) set schema private;
create function public.save_profile_entry(p_candidate_id uuid,p_data jsonb,p_entry_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare eid uuid; begin
 eid:=private.save_profile_entry_base(p_candidate_id,p_data,p_entry_id);
 if p_entry_id is null then perform private.entry_details(eid,p_data); end if;
 return eid;
end $$;
create function public.update_profile_entry(p_candidate_id uuid,p_entry_id uuid,p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform private.update_profile_entry_base(p_candidate_id,p_entry_id,p_data);
 perform private.entry_details(p_entry_id,p_data);
end $$;

create table public.experience_levels(id uuid primary key default gen_random_uuid(),name text not null unique check(length(name) between 2 and 100),active boolean not null default true);
create table public.employment_types(id uuid primary key default gen_random_uuid(),name text not null unique check(length(name) between 2 and 100),active boolean not null default true);
alter table public.experience_levels enable row level security;
alter table public.employment_types enable row level security;
create policy experience_levels_read on public.experience_levels for select using(true);
create policy employment_types_read on public.employment_types for select using(true);
create trigger audit_change after insert or update or delete on public.experience_levels for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.employment_types for each row execute function private.audit_change();
revoke all on public.experience_levels,public.employment_types from anon,authenticated;
grant select on public.experience_levels,public.employment_types to anon,authenticated;
alter table public.jobs add column experience_level_id uuid references public.experience_levels,
 add column employment_type_id uuid references public.employment_types;
-- Standard catalogs are editable by RH; no real candidate information is seeded.
insert into public.experience_levels(name) values('Aprendiz'),('Estágio'),('Auxiliar'),('Assistente'),('Júnior'),('Pleno'),('Sênior'),('Especialista'),('Coordenação'),('Gerência');
insert into public.employment_types(name) values('Tempo integral'),('Meio período'),('Temporário'),('Estágio'),('Aprendiz');

alter function public.save_job(jsonb,uuid) rename to save_job_base;
alter function public.save_job_base(jsonb,uuid) set schema private;
create function public.save_job(p_data jsonb,p_job_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare jid uuid; selected uuid; begin
 jid:=private.save_job_base(p_data,p_job_id);
 if p_data ? 'experience_level_id' then
  selected:=nullif(p_data->>'experience_level_id','')::uuid;
  if selected is not null and not exists(select 1 from public.experience_levels where id=selected and (active or id=(select experience_level_id from public.jobs where id=jid))) then raise exception 'inactive_catalog_item'; end if;
  update public.jobs set experience_level_id=selected where id=jid;
 end if;
 if p_data ? 'employment_type_id' then
  selected:=nullif(p_data->>'employment_type_id','')::uuid;
  if selected is not null and not exists(select 1 from public.employment_types where id=selected and (active or id=(select employment_type_id from public.jobs where id=jid))) then raise exception 'inactive_catalog_item'; end if;
  update public.jobs set employment_type_id=selected where id=jid;
 end if;
 return jid;
end $$;

create or replace function public.manage_catalog(p_catalog text,p_name text,p_id uuid default null,p_active boolean default true) returns void
language plpgsql security definer set search_path='' as $$ declare affected integer; begin
 perform private.require_permission('settings.manage');
 if p_catalog not in ('departments','interest_areas','tags','talent_pools','experience_levels','employment_types') then raise exception 'invalid_catalog'; end if;
 if length(trim(p_name)) not between 2 and 100 then raise exception 'invalid_name'; end if;
 if p_id is null then execute format('insert into public.%I(name,active) values($1,$2)',p_catalog) using trim(p_name),p_active;
 else execute format('update public.%I set name=$1,active=$2 where id=$3',p_catalog) using trim(p_name),p_active,p_id;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'catalog_not_found'; end if;
 end if;
end $$;
create function public.delete_catalog(p_catalog text,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform private.require_permission('settings.manage');
 if p_catalog not in ('departments','interest_areas','tags','talent_pools','experience_levels','employment_types') then raise exception 'invalid_catalog'; end if;
 execute format('select id from public.%I where id=$1 for update',p_catalog) using p_id;
 if p_catalog='talent_pools' and exists(select 1 from public.pool_members where pool_id=p_id) then raise exception 'catalog_in_use'; end if;
 begin
  execute format('delete from public.%I where id=$1',p_catalog) using p_id;
 exception when foreign_key_violation then raise exception 'catalog_in_use'; end;
end $$;

-- Public wrappers preserve the authorization inside the original implementations.
revoke all on function private.candidate_details(jsonb),private.entry_details(uuid,jsonb),private.save_candidate_base(jsonb,uuid),private.create_manual_candidate_base(jsonb),private.manage_candidate_curriculum_base(uuid,jsonb),private.save_profile_entry_base(uuid,jsonb,uuid),private.update_profile_entry_base(uuid,uuid,jsonb),private.save_job_base(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.save_candidate(jsonb,uuid),public.create_manual_candidate(jsonb),public.manage_candidate_curriculum(uuid,jsonb),public.save_profile_entry(uuid,jsonb,uuid),public.update_profile_entry(uuid,uuid,jsonb),public.save_job(jsonb,uuid),public.delete_catalog(text,uuid) from public,anon;
grant execute on function public.save_candidate(jsonb,uuid),public.create_manual_candidate(jsonb),public.manage_candidate_curriculum(uuid,jsonb),public.save_profile_entry(uuid,jsonb,uuid),public.update_profile_entry(uuid,uuid,jsonb),public.save_job(jsonb,uuid),public.delete_catalog(text,uuid) to authenticated;
notify pgrst,'reload schema';

-- One request supplies the navigation permissions; authorization stays in every RPC.
create function public.staff_navigation_permissions() returns text[]
language plpgsql stable security definer set search_path='' as $$ begin
 if not public.is_staff() then raise exception 'permission_denied' using errcode='42501'; end if;
 return array(select code from public.permissions where public.has_permission(code));
end $$;
revoke all on function public.staff_navigation_permissions() from public,anon;
grant execute on function public.staff_navigation_permissions() to authenticated;
