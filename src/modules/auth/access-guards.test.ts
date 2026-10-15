import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

describe('Migration de proteção de cadastro e recuperação em PostgreSQL', () => {
  const database = new PGlite();
  const user = '00000000-0000-4000-8000-000000000171';
  const session = '00000000-0000-4000-8000-000000000173';
  const otherSession = '00000000-0000-4000-8000-000000000174';
  const hash = 'a'.repeat(64);
  async function role(value: 'service_role' | 'authenticated', sessionId = session) {
    await database.exec(`set role ${value}`);
    await database.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: value, sub: user, session_id: sessionId })]);
  }
  async function consume(value = hash) {
    return (await database.query<{ allowed: boolean }>('select public.consume_password_recovery_grant($1) allowed', [value])).rows[0].allowed;
  }
  beforeAll(async () => {
    // Isolated Auth fixtures, not a substitute for integration with GoTrue.
    await database.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema auth;
      create table auth.users(id uuid primary key,email text,deleted_at timestamptz,email_confirmed_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
      grant usage on schema auth to anon,authenticated,service_role;
      insert into auth.users(id,email) values('${user}','guard@example.test');
      insert into auth.sessions values('${session}','${user}'),('${otherSession}','${user}');`);
    await database.exec(await readFile(new URL('../../../supabase/migrations/202610150001_signup_and_recovery_guards.sql', import.meta.url), 'utf8'));
  }, 20000);
  afterAll(async () => { await database.close(); });

  it('não permite consulta de e-mail nem emissão de autorizações pelo cliente', async () => {
    const { rows } = await database.query<{ email: boolean; issue: boolean; rls: boolean; direct_write: boolean }>(`select
      has_function_privilege('anon','public.signup_email_exists(text)','EXECUTE') email,
      has_function_privilege('authenticated','public.issue_password_recovery_grant(uuid,uuid,text)','EXECUTE') issue,
      (select relrowsecurity from pg_class where oid='private.password_recovery_grants'::regclass) rls,
      has_table_privilege('service_role','private.password_recovery_grants','INSERT') direct_write`);
    expect(rows[0]).toEqual({ email: false, issue: false, rls: true, direct_write: false });
    await role('authenticated');
    await expect(database.query('select public.signup_email_exists($1)', ['guard@example.test'])).rejects.toMatchObject({ code: '42501' });
  });
  it('detecta e-mail pendente ou confirmado normalizando caixa e espaços', async () => {
    await role('service_role');
    const lookup = async (email: string) => (await database.query<{ found: boolean }>('select public.signup_email_exists($1) found', [email])).rows[0].found;
    expect(await lookup(' GUARD@EXAMPLE.TEST ')).toBe(true);
    expect(await lookup('new@example.test')).toBe(false);
    await database.exec('reset role');
    await database.query('update auth.users set email_confirmed_at=now() where id=$1', [user]);
    await role('service_role');
    expect(await lookup('guard@example.test')).toBe(true);
  });
  it('vincula autorização à sessão e permite consumo somente uma vez', async () => {
    await role('service_role');
    await database.query('select public.issue_password_recovery_grant($1,$2,$3)', [user, session, hash]);
    await role('authenticated', otherSession);
    expect(await consume()).toBe(false);
    await role('authenticated');
    expect(await consume('b'.repeat(64))).toBe(false);
    expect(await consume()).toBe(true);
    expect(await consume()).toBe(false);
  });
  it('recusa autorização expirada e sessão inexistente', async () => {
    await role('service_role');
    await expect(database.query('select public.issue_password_recovery_grant($1,$2,$3)', [user, '00000000-0000-4000-8000-000000000199', hash])).rejects.toMatchObject({ message: 'invalid_recovery' });
    await database.query('select public.issue_password_recovery_grant($1,$2,$3)', [user, session, hash]);
    await database.exec("reset role; update private.password_recovery_grants set expires_at=now()-interval '1 second'");
    await role('authenticated');
    expect(await consume()).toBe(false);
  });
});
