import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';

const target = 'src/lib/database.types.ts';
try {
  const output = execFileSync(
    process.execPath,
    [
      'node_modules/supabase/dist/supabase.js',
      'gen',
      'types',
      'typescript',
      '--local',
      '--schema',
      'public',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // Normalize CLI output before saving: Windows and Linux can return different formatting.
  const options = await resolveConfig(target);
  const formatted = await format(output, { ...options, filepath: target, endOfLine: 'lf' });
  await writeFile(target, formatted, 'utf8');
  console.log('Tipos gerados pelo Supabase CLI e padronizados pelo Prettier.');
} catch {
  console.error(
    'Não foi possível gerar os tipos. Confira o Supabase local e instale as dependências com npm ci.',
  );
  process.exitCode = 1;
}
