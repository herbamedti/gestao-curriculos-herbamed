import { db } from '@/lib/supabase';
import { isConfigured } from '@/lib/config';

export async function GET() {
  if (!isConfigured()) return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  try {
    const {error}=await (await db()).from('jobs').select('id',{head:true}).limit(1).abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    return Response.json({status:'ok',service:'herbamed-carreiras'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
