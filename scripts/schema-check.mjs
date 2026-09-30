import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFile, readdir, writeFile } from 'node:fs/promises';

export async function testDatabase() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$;
  `.replace("select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'", "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid"));
  await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on all functions in schema auth to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated,anon;`);
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  return db;
}

if (process.argv.includes('--generate')) {
  const db = await testDatabase();
  const { rows: cols } = await db.query(`select table_name,column_name,udt_name,is_nullable,column_default,is_identity from information_schema.columns where table_schema='public' order by table_name,ordinal_position`);
  const map = { uuid:'string',text:'string',varchar:'string',timestamptz:'string',timestamp:'string',date:'string',bool:'boolean',int4:'number',int8:'number',numeric:'number',jsonb:'Json',json:'Json',_text:'string[]',tsvector:'string' };
  const type = (name) => map[name] || (name.startsWith('_') ? `${map[name.slice(1)] || 'string'}[]` : 'string');
  const tables = {};
  for (const col of cols) (tables[col.table_name] ||= []).push(col);
  let output = `// Generated from PostgreSQL catalog by scripts/schema-check.mjs. Prefer npm run db:types with Supabase running.\nexport type Json = string | number | boolean | null | { [key:string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n`;
  for (const [name,columns] of Object.entries(tables)) {
    output += `${name}: { Row: { ${columns.map(c => `${c.column_name}: ${type(c.udt_name)}${c.is_nullable==='YES'?' | null':''}`).join('; ')} }; Insert: { ${columns.map(c=>`${c.column_name}?: ${type(c.udt_name)}${c.is_nullable==='YES'?' | null':''}`).join('; ')} }; Update: { ${columns.map(c=>`${c.column_name}?: ${type(c.udt_name)}${c.is_nullable==='YES'?' | null':''}`).join('; ')} }; Relationships: [] };\n`;
  }
  output += '}; Views: { [_ in never]: never }; Functions: {\n';
  const { rows: funcs } = await db.query(`select p.proname,p.proargnames,p.proargtypes::oid[] argtypes,p.proallargtypes,p.proargmodes,p.pronargdefaults,p.prorettype::regtype::text rettype,p.proretset from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`);
  const { rows: types } = await db.query('select oid,typname from pg_type');
  const oidTypes = Object.fromEntries(types.map(t=>[t.oid,t.typname]));
  for (const f of funcs) {
    const inputNames = f.proargnames?.filter((_,i)=>!f.proargmodes || f.proargmodes[i]==='i') || [];
    const args = inputNames.map((n,i)=>`${n}${i>=inputNames.length-f.pronargdefaults?'?':''}: ${type(oidTypes[f.argtypes[i]])}`).join('; ');
    let ret = f.rettype==='void'?'undefined':f.rettype==='boolean'?'boolean':f.rettype==='jsonb'?'Json':f.rettype==='documents'?"Database['public']['Tables']['documents']['Row']":'string';
    if(f.proargmodes?.includes('t')) ret=`{ ${f.proargnames.map((n,i)=>f.proargmodes[i]==='t'?`${n}: ${type(oidTypes[f.proallargtypes[i]])}`:null).filter(Boolean).join('; ')} }`;
    output+=`${f.proname}: { Args: ${args?`{ ${args} }`:'Record<string, never>'}; Returns: ${ret}${f.proretset?'[]':''} };\n`;
  }
  output+='}; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } };\n';
  await writeFile('src/lib/database.types.ts',output);
  console.log(`Validated migrations; generated ${Object.keys(tables).length} tables and ${funcs.length} functions from PostgreSQL catalog (PGlite).`);
  await db.close();
}
