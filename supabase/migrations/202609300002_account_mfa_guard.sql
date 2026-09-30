-- Reject absent AAL claims too. Invalid email attempts must commit so the
-- attempt counter cannot be reset by a raised exception.
drop function public.set_account_mfa(boolean,text);
create function public.set_account_mfa(p_enabled boolean, p_email_code text default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'permission_denied' using errcode='42501'; end if;
 if not p_enabled and auth.jwt()->>'aal' is distinct from 'aal2' then
   if p_email_code is null or not private.consume_account_email_code(p_email_code) then
     return false;
   end if;
 end if;
 update public.staff set mfa_enabled=p_enabled where user_id=auth.uid() and active;
 return found;
end $$;
revoke all on function public.set_account_mfa(boolean,text) from public, anon, authenticated;
grant execute on function public.set_account_mfa(boolean,text) to authenticated;
