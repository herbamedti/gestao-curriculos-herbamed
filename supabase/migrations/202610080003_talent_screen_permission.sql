-- Screen permission; candidate data authorization and job scope still apply.
insert into public.permissions(code,label) values('talents.read','Visualizar banco de talentos');
insert into public.role_permissions(role_id,permission) select role_id,'talents.read' from public.role_permissions where permission='candidates.read';
create or replace function public.has_permission(p_permission text,p_job_id uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_staff() and exists(select 1 from public.permissions where code=p_permission)
 and (p_permission not in ('users.manage','roles.manage') or public.is_primary_administrator())
 and private.staff_effective_permission(p_permission,p_job_id)
 and (p_permission<>'talents.read' or private.staff_effective_permission('candidates.read',p_job_id))
 and (p_permission like '%.read' or not exists(select 1 from public.permissions where code=split_part(p_permission,'.',1)||'.read')
  or private.staff_effective_permission(split_part(p_permission,'.',1)||'.read',p_job_id))
$$;
