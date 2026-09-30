'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { config, isConfigured } from '@/lib/config';
import type { ActionResult } from '@/lib/result';
const credentials = z.object({ email: z.email().max(254), password: z.string().min(12).max(128) });
async function verifyBot(form: FormData) {
  if (form.get('website')) return false;
  if (config.environment === 'local') return true;
  if (!process.env.TURNSTILE_SECRET_KEY) return false;
  const token = form.get('cf-turnstile-response');
  if (typeof token !== 'string') return false;
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(10000)});
  const result: unknown = await response.json();
  return z.object({success:z.boolean(),hostname:z.string().optional()}).parse(result).success && z.object({hostname:z.string()}).parse(result).hostname===new URL(config.url).hostname;
}
export async function authenticate(_: ActionResult, form: FormData): Promise<ActionResult> {
  if (!isConfigured()) return {ok:false,message:'O serviço de autenticação ainda está em configuração.'};
  try {
    if (!await verifyBot(form)) return {ok:false,message:'Conclua a verificação de segurança e tente novamente.'};
    const mode = z.enum(['login','signup','recover','password']).parse(form.get('mode'));
    const client = await db();
    if(mode==='recover') {
      const email=z.email().parse(form.get('email'));
      await client.auth.resetPasswordForEmail(email,{redirectTo:`${config.url}/auth/callback?next=/nova-senha`});
      return {ok:true,message:'Se houver uma conta para este e-mail, você receberá as instruções para continuar.'};
    }
    if(mode==='password') {
      const password=z.string().min(12).max(128).parse(form.get('password'));
      const {data:{user}}=await client.auth.getUser();
      if(!user) return {ok:false,message:'O link expirou. Solicite uma nova recuperação de senha.'};
      const {error}=await client.auth.updateUser({password});
      if(error) return {ok:false,message:'Não foi possível alterar a senha.'};
      await client.auth.signOut({scope:'global'});
      return {ok:true,message:'Senha alterada. Entre novamente para continuar.',redirect:'/entrar'};
    }
    const {email,password}=credentials.parse(Object.fromEntries(form));
    if(mode==='signup') {
      const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:`${config.url}/auth/callback`}});
      if(error) return {ok:false,message:'Não foi possível concluir o cadastro. Confira os dados ou tente recuperar sua senha.'};
      return {ok:true,message:'Confira seu e-mail para confirmar a conta. Se já possui cadastro, entre ou recupere sua senha.'};
    }
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error) return {ok:false,message:'Não foi possível entrar. Confira suas credenciais e a confirmação de e-mail.'};
    const {data:staff}=await client.rpc('is_staff');
    return {ok:true,message:'Acesso confirmado.',redirect:staff?'/rh':'/candidato'};
  } catch { return {ok:false,message:'Verifique os campos. A senha deve ter entre 12 e 128 caracteres.'}; }
}
export async function microsoft() {
  if(!isConfigured()) redirect('/entrar?erro=configuracao');
  const client=await db();
  const {data,error}=await client.auth.signInWithOAuth({provider:'azure',options:{scopes:'email',redirectTo:`${config.url}/auth/callback?next=/rh`}});
  if(error || !data.url) redirect('/entrar?erro=microsoft');
  redirect(data.url);
}
export async function logout() { const client=await db(); await client.auth.signOut(); redirect('/entrar'); }
