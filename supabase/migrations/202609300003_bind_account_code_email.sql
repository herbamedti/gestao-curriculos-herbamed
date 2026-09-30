alter table private.account_email_challenges
 add column recipient_email text not null default '';

create or replace function private.consume_account_email_code(p_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare challenge private.account_email_challenges%rowtype;
declare current_email text;
begin
 if auth.uid() is null or p_code !~ '^[A-F0-9]{10}$' then return false; end if;
 select * into challenge from private.account_email_challenges
 where user_id=auth.uid() for update;
 if not found or challenge.expires_at < now() or challenge.attempts >= 5 then return false; end if;
 select email into current_email from auth.users where id=auth.uid();
 if current_email is null or lower(current_email) <> lower(challenge.recipient_email) then
   delete from private.account_email_challenges where user_id=auth.uid();
   return false;
 end if;
 if challenge.code_hash <> encode(extensions.digest(p_code,'sha256'),'hex') then
   update private.account_email_challenges set attempts=attempts+1 where user_id=auth.uid();
   return false;
 end if;
 delete from private.account_email_challenges where user_id=auth.uid();
 return true;
end $$;
revoke all on function private.consume_account_email_code(text) from public, anon, authenticated;
