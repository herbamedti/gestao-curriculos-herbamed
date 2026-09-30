import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { db } from '@/lib/supabase';
import { log } from '@/lib/logger';
import type { Database } from '@/lib/database.types';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  if(process.env.ENABLE_LEGACY_STORAGE_UPLOADS!=='true')return new Response('Download de arquivos antigos desativado. Exporte o currículo da plataforma.',{status:410});
  const parsed=z.uuid().safeParse((await params).id);
  if(!parsed.success)return new Response('Arquivo não encontrado',{status:404});
  const client=await db();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return new Response('Autenticação necessária',{status:401});
  const {data:path,error}=await client.rpc('authorize_download',{p_document_id:parsed.data});
  if(error||!path)return new Response('Arquivo indisponível',{status:403});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Serviço de documentos indisponível',{status:503});
  const service=createClient<Database>(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const ttl=Math.min(300,Math.max(30,Number(process.env.SIGNED_URL_TTL_SECONDS)||60));
  const {data,error:signError}=await service.storage.from('documents').createSignedUrl(path,ttl,{download:true});
  if(signError||!data?.signedUrl) {log('download_sign_failed',{code:signError?.message});return new Response('Arquivo indisponível',{status:503});}
  const downloadUrl=new URL(data.signedUrl);
  if(process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const publicUrl=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    downloadUrl.protocol=publicUrl.protocol;
    downloadUrl.host=publicUrl.host;
  }
  const response=NextResponse.redirect(downloadUrl);
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
