-- Lock the application before scheduling so removal and scheduling cannot race.
create function private.guard_active_interview_application() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.applications; begin
 if new.status='scheduled' then
  select * into a from public.applications where id=new.application_id for update;
  if a.id is null or a.status<>'active' or a.unlinked_at is not null then raise exception 'application_changed'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_active_interview_application() from public,anon,authenticated,service_role;
create trigger active_interview_application before insert or update on public.interviews for each row execute function private.guard_active_interview_application();
