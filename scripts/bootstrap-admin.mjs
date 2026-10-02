import { execFileSync } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Inputs and generated credentials stay in a separate, ignored environment
// file. This script never loads or writes the application's local .env files.
const file = '.env.admin-bootstrap.local';
process.loadEnvFile(file);
const input = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(2).max(160),
}).parse({ email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME });
const ref = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (!/^[a-z]{20}$/.test(ref)) throw new Error('Project ref inválido. Vincule o projeto hospedado primeiro.');
const cli = args => JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args, '--output', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
const projects = cli(['projects', 'list']);
if (!projects.some(p => p.id === ref && p.linked && p.status === 'ACTIVE_HEALTHY'))
  throw new Error('O projeto vinculado não está ativo na conta autenticada.');
const keys = cli(['projects', 'api-keys', '--project-ref', ref, '--reveal']);
const secret = keys.find(k => k.type === 'secret')?.api_key || keys.find(k => k.name === 'service_role')?.api_key;
if (!secret) throw new Error('Chave de servidor indisponível.');
const client = createClient(`https://${ref}.supabase.co`, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const staff = await client.from('staff').select('user_id', { count: 'exact', head: true });
if (staff.error) throw new Error('Aplique as migrations no projeto hospedado antes de provisionar.');
if (staff.count) throw new Error('Já existe equipe neste banco. Não houve alteração de usuários ou credenciais.');
const users = await client.auth.admin.listUsers({ perPage: 1 });
if (users.error || users.data.total) throw new Error('O bootstrap automático exige um Auth vazio para evitar assumir contas existentes.');
if (process.env.ADMIN_PASSWORD) throw new Error('Este arquivo já contém credenciais. Não serão redefinidas.');
const password = `Hbm!${randomBytes(24).toString('base64url')}9a`;
await access(file);
// Save before creating the account, so a connection interruption never loses
// the only copy of its generated password.
await writeFile(file, `ADMIN_EMAIL=${input.email}\nADMIN_NAME=${input.name}\nADMIN_PASSWORD=${password}\nADMIN_PROJECT_REF=${ref}\n`, { mode: 0o600 });
const created = await client.auth.admin.createUser({
  email: input.email, password, email_confirm: true, user_metadata: { full_name: input.name },
});
if (created.error || !created.data.user) throw new Error('Não foi possível criar a conta; as credenciais geradas estão no arquivo privado.');
const assigned = await client.rpc('bootstrap_password_staff', { p_user_id: created.data.user.id, p_display_name: input.name });
if (assigned.error) throw new Error('Conta criada, mas a concessão de acesso falhou. Confira a migration; não redefina as credenciais.');
console.log('Administrador geral provisionado no projeto hospedado. Credenciais salvas em .env.admin-bootstrap.local (ignorado pelo Git). MFA por autenticador permanece ativo.');
