-- Removing a person from one job preserves their profile and recruitment history.
alter table public.applications add column unlinked_at timestamptz;
alter table public.applications add constraint unlinked_application_closed check(unlinked_at is null or status='closed');
-- Existing SELECT RLS and revoked direct writes remain in force on applications.
insert into public.permissions(code,label) values('applications.unlink','Desvincular candidatos de vagas');
insert into public.role_permissions(role_id,permission)
 select role_id,'applications.unlink' from public.role_permissions where permission='applications.link';

create function public.list_job_candidates(p_job_id uuid,p_search text default '',p_stage_id uuid default null,p_status text default 'linked',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 perform private.require_permission('applications.read',p_job_id);
 perform private.require_permission('candidates.read',p_job_id);
 if p_status not in ('all','linked','active','withdrawn','closed','unlinked') or p_page not between 1 and 10000 or char_length(p_search)>100 then raise exception 'invalid_application_filter'; end if;
 with all_rows as (
  select a.*,c.full_name,c.email,c.phone,c.city,c.headline,s.name stage_name,s.terminal,
   public.can_candidate(c.id,'candidates.edit') can_edit
  from public.applications a join public.candidates c on c.id=a.candidate_id join public.job_stages s on s.id=a.stage_id
  where a.job_id=p_job_id and public.can_candidate(c.id,'candidates.read')
 ), filtered as (
  select * from all_rows where (p_stage_id is null or stage_id=p_stage_id)
  and (p_search='' or position(lower(trim(p_search)) in lower(full_name||' '||email||' '||coalesce(headline,'')))>0)
  and (p_status='all' or (p_status='linked' and unlinked_at is null) or (p_status='unlinked' and unlinked_at is not null)
   or (p_status in ('active','withdrawn','closed') and status=p_status and unlinked_at is null))
 ), paged as (select * from filtered order by created_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object(
  'id',id,'candidate_id',candidate_id,'stage_id',stage_id,'stage_name',stage_name,'terminal',terminal,
  'status',status,'created_at',created_at,'updated_at',updated_at,'unlinked_at',unlinked_at,
  'full_name',full_name,'email',email,'phone',phone,'city',city,'headline',headline,'can_edit',can_edit) order by created_at desc,id) from paged),'[]'::jsonb),
  'total',(select count(*) from filtered),'linked',(select count(*) from all_rows where unlinked_at is null),
  'active',(select count(*) from all_rows where status='active' and unlinked_at is null),
  'unlinked',(select count(*) from all_rows where unlinked_at is not null)) into result;
 return result;
end $$;

create function public.search_job_candidate_links(p_job_id uuid,p_search text)
returns table(id uuid,full_name text,email text,city text,headline text,already_linked boolean)
language plpgsql stable security definer set search_path='' as $$ begin
 perform private.require_permission('applications.link',p_job_id);
 perform private.require_permission('candidates.read',p_job_id);
 if char_length(trim(p_search)) not between 2 and 100 then raise exception 'candidate_search_required'; end if;
 return query select c.id,c.full_name,c.email,c.city,c.headline,
  exists(select 1 from public.applications a where a.job_id=p_job_id and a.candidate_id=c.id and a.unlinked_at is null)
 from public.candidates c where c.archived_at is null and public.can_candidate(c.id,'candidates.read')
 and position(lower(trim(p_search)) in lower(c.full_name||' '||c.email))>0
 order by c.full_name,c.id limit 20;
end $$;

create function public.update_job_application(p_job_id uuid,p_application_id uuid,p_expected_updated_at timestamptz,p_stage_id uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.applications; uid uuid; begin
 perform private.require_permission('applications.move',p_job_id);
 perform private.rate_limit('job_application_edit',100);
 select * into a from public.applications where id=p_application_id and job_id=p_job_id for update;
 if a.id is null then raise exception 'permission_denied' using errcode='42501'; end if;
 if a.updated_at is distinct from p_expected_updated_at or a.unlinked_at is not null then raise exception 'application_changed'; end if;
 if p_status not in ('active','closed') or p_status is null or char_length(trim(coalesce(p_note,''))) not between 3 and 2000 then raise exception 'application_reason_required'; end if;
 if not exists(select 1 from public.job_stages where id=p_stage_id and job_id=p_job_id) then raise exception 'invalid_stage'; end if;
 if a.stage_id=p_stage_id and a.status=p_status then raise exception 'application_unchanged'; end if;
 update public.applications set stage_id=p_stage_id,status=p_status where id=a.id;
 if p_status='closed' then update public.interviews set status='cancelled' where application_id=a.id and status='scheduled'; end if;
 insert into public.application_events(application_id,from_stage,to_stage,actor_id,note)
 values(a.id,a.stage_id,p_stage_id,auth.uid(),'Atualização pelo RH ('||p_status||'): '||trim(p_note));
 select user_id into uid from public.candidates where id=a.candidate_id;
 perform private.notify(uid,'Atualização da candidatura','A equipe atualizou sua candidatura. Confira os detalhes no portal.');
end $$;

create function public.unlink_job_candidate(p_job_id uuid,p_application_id uuid,p_expected_updated_at timestamptz,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.applications; uid uuid; begin
 perform private.require_permission('applications.unlink',p_job_id);
 perform private.rate_limit('job_application_unlink',50);
 select * into a from public.applications where id=p_application_id and job_id=p_job_id for update;
 if a.id is null then raise exception 'permission_denied' using errcode='42501'; end if;
 if a.updated_at is distinct from p_expected_updated_at or a.unlinked_at is not null then raise exception 'application_changed'; end if;
 if char_length(trim(coalesce(p_note,''))) not between 3 and 2000 then raise exception 'application_reason_required'; end if;
 update public.applications set status='closed',unlinked_at=now() where id=a.id;
 update public.interviews set status='cancelled' where application_id=a.id and status='scheduled';
 insert into public.application_events(application_id,from_stage,actor_id,note)
 values(a.id,a.stage_id,auth.uid(),'Desvinculação da vaga pelo RH: '||trim(p_note));
 select user_id into uid from public.candidates where id=a.candidate_id;
 perform private.notify(uid,'Candidatura desvinculada','A equipe encerrou seu vínculo com esta vaga. Seu currículo e as outras candidaturas foram preservados.');
end $$;

create or replace function public.link_candidate_to_job(p_candidate_id uuid,p_job_id uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; sid uuid; aid uuid; candidate_user uuid; previous public.applications; begin
 perform private.require_permission('applications.link',p_job_id);
 perform private.rate_limit('staff_application',50);
 if length(trim(coalesce(p_note,'')))<3 or length(p_note)>2000 then raise exception 'link_reason_required'; end if;
 select id,user_id into cid,candidate_user from public.candidates where id=p_candidate_id and archived_at is null for update;
 if cid is null or not public.can_candidate(cid,'candidates.read') then raise exception 'permission_denied' using errcode='42501'; end if;
 if cardinality(public.curriculum_missing(cid))>0 then raise exception 'curriculum_incomplete'; end if;
 perform 1 from public.jobs where id=p_job_id and status='published' and visibility='public' and (deadline is null or deadline>now()) for update;
 if not found then raise exception 'job_unavailable'; end if;
 select * into previous from public.applications where candidate_id=cid and job_id=p_job_id for update;
 if previous.id is not null and previous.unlinked_at is null then raise exception 'already_linked'; end if;
 select id into sid from public.job_stages where job_id=p_job_id order by position limit 1;
 if sid is null then raise exception 'job_stage_missing'; end if;
 if previous.id is null then
  insert into public.applications(candidate_id,job_id,stage_id,resume_id) values(cid,p_job_id,sid,null) returning id into aid;
 else
  aid=previous.id;
  update public.applications set status='active',stage_id=sid,unlinked_at=null where id=aid;
 end if;
 insert into public.application_events(application_id,from_stage,to_stage,actor_id,note)
 values(aid,previous.stage_id,sid,auth.uid(),case when previous.id is null then 'Vinculação pelo RH: ' else 'Nova vinculação pelo RH: ' end||trim(p_note));
 perform private.notify(candidate_user,'Nova candidatura vinculada','A equipe de recrutamento vinculou seu perfil a uma vaga. Confira os detalhes no portal.');
 return aid;
end $$;

revoke all on function public.list_job_candidates(uuid,text,uuid,text,integer),public.search_job_candidate_links(uuid,text),
 public.update_job_application(uuid,uuid,timestamptz,uuid,text,text),public.unlink_job_candidate(uuid,uuid,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.list_job_candidates(uuid,text,uuid,text,integer),public.search_job_candidate_links(uuid,text),
 public.update_job_application(uuid,uuid,timestamptz,uuid,text,text),public.unlink_job_candidate(uuid,uuid,timestamptz,text) to authenticated;
