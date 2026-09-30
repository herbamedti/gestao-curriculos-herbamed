import { db } from '@/lib/supabase';
export async function GET() {
  const client=await db();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return new Response('Autenticação necessária',{status:401});
  const {data,error}=await client.rpc('export_my_data');
  if(error)return new Response('Exportação indisponível',{status:403});
  return new Response(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="meus-dados-herbamed.json"','Cache-Control':'private, no-store'}});
}
