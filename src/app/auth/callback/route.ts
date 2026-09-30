import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/supabase';
import { config } from '@/lib/config';
export async function GET(request: NextRequest) {
  const code=request.nextUrl.searchParams.get('code');
  const next=request.nextUrl.searchParams.get('next');
  const destination=next==='/rh'||next==='/nova-senha'?next:'/candidato';
  if(code) { const client=await db(); const {error}=await client.auth.exchangeCodeForSession(code); if(!error) return NextResponse.redirect(new URL(destination,config.url)); }
  return NextResponse.redirect(new URL('/entrar?erro=confirmacao',config.url));
}
