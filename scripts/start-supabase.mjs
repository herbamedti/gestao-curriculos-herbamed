import { execFileSync } from 'node:child_process';

try {
  // The CLI prints local keys on stdout; keep them out of routine terminal output.
  execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','start','-x','realtime,storage-api,imgproxy,edge-runtime,logflare,vector'],{stdio:['inherit','pipe','pipe']});
  console.log('Supabase local pronto: PostgreSQL, Auth, API, painel e e-mail de teste.');
} catch {
  console.error('Não foi possível iniciar o Supabase local. Execute npm run db:start para tentar novamente.');
  process.exitCode=1;
}
