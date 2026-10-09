import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/supabase';
import { config } from '@/lib/config';
export async function GET(request: NextRequest) {
  const code=request.nextUrl.searchParams.get('code');
  const next=request.nextUrl.searchParams.get('next');
  const destination=next==='/rh'||next==='/nova-senha'?next:'/candidato';
  if(code) {
    const client=await db();
    const {data,error}=await client.auth.exchangeCodeForSession(code);
    if(!error&&data.user) {
      const google=request.nextUrl.searchParams.get('provider')==='google';
      if(google) {
        const staff=await client.from('staff').select('user_id').eq('user_id',data.user.id).maybeSingle();
        if(staff.error||staff.data) {
          await client.auth.signOut();
          return NextResponse.redirect(new URL('/entrar?erro=google-equipe',config.url));
        }
      }
      const status=await client.rpc('candidate_registration_status');
      if(status.error||status.data==='unavailable')return NextResponse.redirect(new URL('/conta-indisponivel',config.url));
      if(status.data==='required')return NextResponse.redirect(new URL('/completar-cadastro',config.url));
      if(status.data==='password_required')return NextResponse.redirect(new URL('/primeiro-acesso',config.url));
      if(status.data==='complete')return NextResponse.redirect(new URL(google?'/candidato':destination,config.url));
    }
  }
  return NextResponse.redirect(new URL('/entrar?erro=confirmacao',config.url));
}
