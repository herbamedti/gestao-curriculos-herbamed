import { db } from '@/lib/supabase';
function csv(value:unknown) {return `"${String(value??'').replaceAll('"','""')}"`;}
export async function GET() {
  const client=await db();const {data:{user}}=await client.auth.getUser();if(!user)return new Response('Autenticação necessária',{status:401});
  const {data,error}=await client.rpc('export_candidates');if(error)return new Response('Sem permissão',{status:403});
  const rows=[['id','nome','cidade','atuacao','cadastro'].join(','),...(data||[]).map(r=>[r.id,r.full_name,r.city,r.headline,r.created_at].map(csv).join(','))];
  return new Response('\ufeff'+rows.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="candidatos-herbamed.csv"','Cache-Control':'private, no-store'}});
}
