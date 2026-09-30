import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
try {
  const output=execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','gen','types','typescript','--local','--schema','public'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  await writeFile('src/lib/database.types.ts',output);
  console.log('Tipos gerados pelo Supabase CLI.');
}catch{console.error('Inicie o Supabase local antes de gerar tipos.');process.exitCode=1;}
