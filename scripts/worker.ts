import { createClient } from '@supabase/supabase-js';
import { createConnection } from 'node:net';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { inspectPdf } from '../src/modules/documents/inspect';

type Document = { id:string;candidate_id:string;object_path:string;kind:'resume'|'photo';size_bytes:number;status:string;created_at:string };
const api=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!api||!key)throw new Error('Supabase worker configuration missing');
const client=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}});
const pool=process.env.DATABASE_URL?new pg.Pool({connectionString:process.env.DATABASE_URL,max:2}):null;
let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});
process.on('SIGINT',()=>{stopping=true;});
function report(event:string,code?:string) {console.log(JSON.stringify({event,code,time:new Date().toISOString()}));}

async function clamScan(content:Buffer):Promise<boolean> {
  const host=process.env.CLAMAV_HOST;
  if(!host)throw new Error('scanner_unavailable');
  const port=Number(process.env.CLAMAV_PORT)||3310;
  return new Promise((resolve,reject)=>{
    const socket=createConnection({host,port});
    let answer='';
    socket.setTimeout(30000);
    socket.on('connect',()=>{
      socket.write('zINSTREAM\0');
      for(let i=0;i<content.length;i+=64*1024){const chunk=content.subarray(i,i+64*1024);const length=Buffer.alloc(4);length.writeUInt32BE(chunk.length);socket.write(length);socket.write(chunk);}
      socket.end(Buffer.alloc(4));
    });
    socket.on('data',part=>{answer+=part.toString('utf8');});
    socket.on('end',()=>{if(answer.includes('FOUND'))resolve(false);else if(answer.includes('OK'))resolve(true);else reject(new Error('scanner_unavailable'));});
    socket.on('timeout',()=>{socket.destroy();reject(new Error('scanner_timeout'));});
    socket.on('error',reject);
  });
}
async function processDocument(doc:Document) {
  const {data:claimed,error:claimError}=await client.from('documents').update({status:'scanning'}).eq('id',doc.id).in('status',['pending','error']).select('id');
  if(claimError||!claimed?.length)return;
  try {
    const {data:file,error}=await client.storage.from('quarantine').download(doc.object_path);
    if(error||!file)throw new Error('quarantine_missing');
    let content=Buffer.from(await file.arrayBuffer());
    if(content.length!==doc.size_bytes)throw new Error('size_mismatch');
    if(doc.kind==='resume')await inspectPdf(content);
    if(!await clamScan(content))throw new Error('malware_found');
    if(doc.kind==='photo') {
      const img=sharp(content,{limitInputPixels:24_000_000});
      const meta=await img.metadata();
      if(!['jpeg','png'].includes(meta.format||''))throw new Error('invalid_image');
      content=await img.rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).jpeg({quality:86}).toBuffer();
    }
    const sha256=createHash('sha256').update(content).digest('hex');
    const {error:uploadError}=await client.storage.from('documents').upload(doc.object_path,content,{contentType:doc.kind==='resume'?'application/pdf':'image/jpeg',upsert:false});
    if(uploadError)throw new Error('approved_storage_failed');
    const {error:updateError}=await client.from('documents').update({status:'clean',sha256,scanned_at:new Date().toISOString(),scan_message:null}).eq('id',doc.id);
    if(updateError)throw new Error('metadata_update_failed');
    await client.storage.from('quarantine').remove([doc.object_path]);
    report('document_approved');
  } catch(error) {
    const code=error instanceof Error?error.message:'scan_error';
    const rejected=['invalid_pdf','active_pdf','invalid_image','malware_found','size_mismatch'].includes(code);
    await client.from('documents').update({status:rejected?'rejected':'error',scan_message:code,scanned_at:new Date().toISOString()}).eq('id',doc.id);
    if(rejected)await client.storage.from('quarantine').remove([doc.object_path]);
    report('document_scan_failed',code);
  }
}
async function processOutbox() {
  if(!pool||!process.env.SMTP_HOST)return;
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||25,secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
  const {rows}=await pool.query<{id:string;email:string;subject:string;body:string}>(`with picked as (select id from private.outbox where status in ('pending','failed') and next_attempt_at<=now() and attempts<5 order by created_at limit 10 for update skip locked)
   update private.outbox o set status='sending',attempts=attempts+1 from picked p,auth.users u where o.id=p.id and u.id=o.recipient_id returning o.id,u.email,o.subject,o.body`);
  for(const item of rows){try{await transport.sendMail({from:process.env.SMTP_FROM||'Herbamed Carreiras <no-reply@example.test>',to:item.email,subject:item.subject,text:item.body});await pool.query("update private.outbox set status='sent' where id=$1",[item.id]);report('email_sent');}catch{await pool.query("update private.outbox set status='failed',next_attempt_at=now()+interval '5 minutes' * greatest(1,attempts) where id=$1",[item.id]);report('email_failed');}}
}
async function cycle() {
  const {data,error}=await client.from('documents').select('id,candidate_id,object_path,kind,size_bytes,status,created_at').in('status',['pending','error']).lte('created_at',new Date(Date.now()-30_000).toISOString()).order('created_at').limit(10);
  if(error)throw error;
  for(const doc of data||[])if(!stopping)await processDocument(doc as Document);
  await processOutbox();
}
async function main() {
  while(!stopping){try{await cycle();}catch(error){report('worker_cycle_failed',error instanceof Error?error.message:'unknown');}await new Promise(resolve=>setTimeout(resolve,10000));}
  await pool?.end();
}
void main();
