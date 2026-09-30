-- Public jobs must not reference applications through an invoker policy: anon has no table grant.
create function public.owns_job_application(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.applications a join public.candidates c on c.id=a.candidate_id
   where a.job_id=p_job_id and c.user_id=auth.uid())
$$;
revoke all on function public.owns_job_application(uuid) from public,anon,authenticated;
grant execute on function public.owns_job_application(uuid) to anon,authenticated;
drop policy jobs_read on public.jobs;
create policy jobs_read on public.jobs for select
using((status='published' and visibility='public') or public.has_permission('jobs.read',id) or public.owns_job_application(id));
