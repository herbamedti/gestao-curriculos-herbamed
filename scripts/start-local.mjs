import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function run(command,args){execFileSync(command,args,{stdio:'inherit'});}
run(process.execPath,['scripts/start-supabase.mjs']);
if(!existsSync('.env')||!existsSync('.env.local'))run(process.execPath,['scripts/local-setup.mjs']);
run('docker',['compose','up','-d','--build']);
console.log('Portal disponível em http://localhost:3000');
