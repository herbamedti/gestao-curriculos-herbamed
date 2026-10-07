-- Delivery receipts contain only opaque hashes/leases, never recipients, tokens or message bodies.
create table private.email_hook_deliveries (
 key text primary key check (key ~ '^[a-f0-9]{64}$'),
 lease uuid not null,
 sent boolean not null default false,
 lease_until timestamptz not null,
 created_at timestamptz not null default now()
);
alter table private.email_hook_deliveries enable row level security;
create policy email_hook_service_only on private.email_hook_deliveries
 for all to service_role using (true) with check (true);
revoke all on private.email_hook_deliveries from public, anon, authenticated, service_role;

create function public.claim_email_delivery(p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt private.email_hook_deliveries%rowtype;
begin
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'invalid_delivery_key'; end if;
 delete from private.email_hook_deliveries where key in (
   select key from private.email_hook_deliveries where created_at < now()-interval '2 days' limit 100
 );
 insert into private.email_hook_deliveries(key,lease,lease_until)
 values(p_key,gen_random_uuid(),now()+interval '30 seconds')
 on conflict(key) do nothing returning * into receipt;
 if found then return jsonb_build_object('state','claimed','lease',receipt.lease); end if;
 select * into receipt from private.email_hook_deliveries where key=p_key for update;
 if receipt.sent then return jsonb_build_object('state','sent'); end if;
 if receipt.lease_until > now() then return jsonb_build_object('state','busy'); end if;
 update private.email_hook_deliveries set lease=gen_random_uuid(),lease_until=now()+interval '30 seconds'
 where key=p_key returning * into receipt;
 return jsonb_build_object('state','claimed','lease',receipt.lease);
end $$;

create function public.finish_email_delivery(p_key text,p_lease uuid,p_sent boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_sent then
   update private.email_hook_deliveries set sent=true
   where key=p_key and lease=p_lease and not sent;
 else
   delete from private.email_hook_deliveries where key=p_key and lease=p_lease and not sent;
 end if;
 return found;
end $$;
revoke all on function public.claim_email_delivery(text) from public,anon,authenticated;
revoke all on function public.finish_email_delivery(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_email_delivery(text) to service_role;
grant execute on function public.finish_email_delivery(text,uuid,boolean) to service_role;
