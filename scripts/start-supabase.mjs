import { execFileSync } from 'node:child_process';

try {
  // A first CI boot streams image-pull progress. Never buffer stdout: besides
  // containing local keys, that stream can exceed execFileSync's default 1 MB.
  execFileSync(process.execPath,[
    'node_modules/supabase/dist/supabase.js','start','--yes',
    '-x','realtime,storage-api,imgproxy,edge-runtime,logflare,vector',
  ],{stdio:['ignore','ignore','pipe'],maxBuffer:16*1024*1024});
  console.log('Supabase local pronto: PostgreSQL, Auth, API, painel e e-mail de teste.');
} catch (error) {
  // Only short error lines from stderr are printed, never the CLI's key-bearing
  // stdout. Redact common credential shapes before sending diagnostics to CI.
  const stderr=error instanceof Error && 'stderr' in error ? String(error.stderr ?? '') : '';
  const diagnostic=stderr.split(/\r?\n/)
    .filter(line=>/error|failed|unhealthy|timeout|unable|exited|permission|invalid|not found|could not/i.test(line))
    .slice(-12)
    .map(line=>line
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[chave ocultada]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[token ocultado]')
      .replace(/(?:postgres(?:ql)?:\/\/)[^@\s]+@/gi,'postgresql://[credencial ocultada]@')
      .replace(/(password|secret|token|key)=[^\s,;]+/gi,'$1=[oculto]'));
  console.error('Não foi possível iniciar o Supabase local.');
  if (diagnostic.length) console.error(diagnostic.join('\n'));
  else console.error('O CLI não forneceu uma linha de diagnóstico no stderr.');
  process.exitCode=1;
}
