import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { db } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
const requestSchema=z.object({candidateId:z.uuid(),name:z.string().min(1).max(255),size:z.number().int().min(1).max(5*1024*1024),kind:z.enum(['resume','photo'])});
export async function POST(request:Request) {
  // Historical upload path stays in the repository but is off in the structured-CV mode.
  if(process.env.ENABLE_LEGACY_STORAGE_UPLOADS!=='true')return new Response('Envio de arquivos desativado. Preencha o currículo na plataforma.',{status:410});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response('Tipo inválido',{status:415});
  if(Number(request.headers.get('content-length')||0)>1024)return new Response('Solicitação muito grande',{status:413});
  let data:z.infer<typeof requestSchema>;
  try {data=requestSchema.parse(await request.json());}catch{return new Response('Dados inválidos',{status:400});}
  if(data.kind==='resume'&&!data.name.toLowerCase().endsWith('.pdf'))return new Response('Formato inválido',{status:400});
  if(data.kind==='photo'&&(!/\.(png|jpe?g)$/i.test(data.name)||data.size>2*1024*1024))return new Response('Formato inválido',{status:400});
  const client=await db();
  const {data:user}=await client.auth.getUser();
  if(!user.user)return new Response('Autenticação necessária',{status:401});
  const {data:document,error}=await client.rpc('register_document',{p_candidate_id:data.candidateId,p_name:data.name,p_size:data.size,p_kind:data.kind});
  if(error||!document)return new Response('Não foi possível registrar o documento',{status:403});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Serviço indisponível',{status:503});
  const service=createClient<Database>(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const signed=await service.storage.from('quarantine').createSignedUploadUrl(document.object_path);
  if(signed.error||!signed.data)return new Response('Serviço indisponível',{status:503});
  return Response.json({path:document.object_path,token:signed.data.token},{headers:{'Cache-Control':'no-store'}});
}
