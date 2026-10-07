import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const validator = fileURLToPath(new URL('../../../scripts/validate-deploy-env.mjs', import.meta.url));
const base = { ...process.env, APP_ENV: 'demo', APP_URL: 'https://app.example.test',
  SUPABASE_URL: 'https://project.example.test', SUPABASE_ANON_KEY: 'chave-publica-ficticia',
  SUPABASE_SERVICE_ROLE_KEY: 'segredo-ficticio', ENABLE_TURNSTILE: 'false', ENABLE_EMAIL: 'true',
  ENABLE_LEGACY_STORAGE_UPLOADS: 'false', NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  EMAIL_PROVIDER: 'microsoft_graph', MS_GRAPH_TENANT_ID: '00000000-0000-4000-8000-000000000001',
  MS_GRAPH_CLIENT_ID: '00000000-0000-4000-8000-000000000002', MS_GRAPH_CLIENT_SECRET: 'segredo-graph-ficticio',
  MS_GRAPH_SENDER: 'carreiras@example.test', SUPABASE_SEND_EMAIL_HOOK_SECRET: `v1,whsec_${Buffer.alloc(32, 1).toString('base64')}`,
  SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_FROM: '',
};
function run(changes: Record<string, string>) {
  return spawnSync(process.execPath, [validator], { env: { ...base, ...changes }, encoding: 'utf8' });
}
describe('build hospedado com Graph', () => {
  it('aceita Graph sem SMTP e não ativa envio no demo desativado', () => {
    expect(run({}).status).toBe(0);
    expect(run({ ENABLE_EMAIL: 'false', MS_GRAPH_CLIENT_SECRET: '', SUPABASE_SEND_EMAIL_HOOK_SECRET: '' }).status).toBe(0);
  });
  it('recusa Graph incompleto, URLs locais e provedor desconhecido sem imprimir segredos', () => {
    const missing = run({ SUPABASE_SEND_EMAIL_HOOK_SECRET: '' });
    expect(missing.status).toBe(1); expect(missing.stderr).toContain('SUPABASE_SEND_EMAIL_HOOK_SECRET');
    expect(missing.stderr).not.toContain(base.MS_GRAPH_CLIENT_SECRET);
    expect(run({ MS_GRAPH_CLIENT_ID: 'inválido' }).status).toBe(1);
    expect(run({ MS_GRAPH_SENDER: 'Herbamed <carreiras@example.test>' }).status).toBe(1);
    expect(run({ APP_URL: 'http://localhost:3000' }).status).toBe(1);
    expect(run({ EMAIL_PROVIDER: 'outro' }).status).toBe(1);
  });
  it('mantém as exigências SMTP apenas quando o provedor é SMTP', () => {
    expect(run({ EMAIL_PROVIDER: 'smtp' }).status).toBe(1);
    expect(run({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'ficticio',
      SMTP_PASSWORD: 'senha-ficticia', SMTP_FROM: 'carreiras@example.test' }).status).toBe(0);
  });
});
