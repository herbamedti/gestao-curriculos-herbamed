'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '@/lib/supabase';
import { config, features, isConfigured } from '@/lib/config';
import { serviceDb } from '@/lib/service-db';
import { log } from '@/lib/logger';
import { loginDiagnostic, loginFailure } from './login-error';
import type { ActionResult } from '@/lib/result';
import { registrationSchema } from './registration-schema';
import { signupQuotaKeys } from './signup-origin';
const credentials = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)), password: z.string().min(12).max(128) });
async function verifyBot(form: FormData) {
  if (form.get('website')) return false;
  if (!features.turnstile) return true;
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
      if (!features.email) return {ok:false,message:'A recuperação por e-mail está temporariamente desativada. Procure o administrador.'};
      const email=z.email().parse(form.get('email'));
      await client.auth.resetPasswordForEmail(email,{redirectTo:`${config.url}/auth/callback?next=/nova-senha`});
      return {ok:true,message:'Se houver uma conta para este e-mail, você receberá as instruções para continuar.'};
    }
    if(mode==='password') {
      if (!features.email) return {ok:false,message:'A recuperação por e-mail está temporariamente desativada. Altere a senha em Configurações → Conta com o autenticador.'};
      const password=z.string().min(12).max(128).parse(form.get('password'));
      const {data:{user}}=await client.auth.getUser();
      if(!user) return {ok:false,message:'O link expirou. Solicite uma nova recuperação de senha.'};
      const {error}=await client.auth.updateUser({password});
      if(error) return {ok:false,message:'Não foi possível alterar a senha.'};
      await client.auth.signOut({scope:'global'});
      return {ok:true,message:'Senha alterada. Entre novamente para continuar.',redirect:'/entrar'};
    }
    const submitted = Object.fromEntries(form);
    if (mode === 'signup') {
      const checked = registrationSchema.safeParse(submitted);
      if (!checked.success) return {ok:false,message:checked.error.issues[0]?.path[0] === 'email' ? 'Informe um e-mail válido.' : checked.error.issues[0]?.message || 'Confira os dados do cadastro.'};
    }
    const {email,password}=credentials.parse(submitted);
    if(mode==='signup') {
      const parsed = registrationSchema.safeParse(Object.fromEntries(form));
      if (!parsed.success) return {ok:false,message:parsed.error.issues[0]?.message || 'Confira os dados do cadastro.'};
      const service = serviceDb();
      if (!service) return {ok:false,message:'O cadastro está indisponível neste ambiente.'};
      const keys = signupQuotaKeys(await headers(), process.env.SUPABASE_SERVICE_ROLE_KEY!, parsed.data.email, process.env.VERCEL === '1');
      const ticket = randomBytes(32).toString('hex');
      const reserved = await service.rpc('prepare_candidate_signup', {
        p_origin_key: keys.origin, p_email_key: keys.email, p_email: parsed.data.email,
        p_cpf: parsed.data.cpf, p_birth_date: parsed.data.birth_date,
        p_ticket_hash: createHash('sha256').update(ticket).digest('hex'),
      });
      if (reserved.error) return {ok:false,message:'O cadastro está indisponível. Tente novamente mais tarde.'};
      if (!reserved.data) return {ok:false,message:'Muitas tentativas de cadastro. Aguarde antes de tentar novamente.'};
      const signupEmail = parsed.data.email;
      if (!features.email) {
        // This mode deliberately skips email delivery. Only the server can
        // create a confirmed account; no staff role is granted by registration.
        const created = await service.auth.admin.createUser({email:signupEmail,password,email_confirm:true,user_metadata:{registration_ticket:ticket}});
        if (created.error) return {ok:false,message:'Não foi possível concluir o cadastro. Se já possui uma conta, entre com sua senha.'};
        const signedIn = await client.auth.signInWithPassword({email:signupEmail,password});
        return signedIn.error
          ? {ok:true,message:'Conta criada. Entre com seu e-mail e senha.',redirect:'/entrar'}
          : {ok:true,message:'Conta criada.',redirect:'/candidato'};
      }
      const {data,error}=await client.auth.signUp({email:signupEmail,password,options:{data:{registration_ticket:ticket},emailRedirectTo:`${config.url}/auth/callback`}});
      if(error) return {ok:false,message:'Não foi possível concluir o cadastro. Confira os dados ou tente recuperar sua senha.'};
      if(data.session) {
        await client.auth.signOut();
        log('auth.signup_confirmation_disabled', {code:'configuration_error'});
        return {ok:false,message:'A confirmação de e-mail está indisponível. Avise o administrador para revisar a configuração.'};
      }
      return {ok:true,message:'Confira seu e-mail para confirmar a conta. Se já possui cadastro, entre ou recupere sua senha.'};
    }
    const {data:login,error}=await client.auth.signInWithPassword({email,password});
    if(error) {
      const failure = loginFailure(error, features.email);
      log('auth.login_failed', { code: loginDiagnostic(error, failure.code) });
      return {ok:false,message:failure.message};
    }
    const {data:staff}=await client.rpc('is_staff');
    if (staff) {
      const [{data:account},{data:assurance}] = await Promise.all([
        client.from('staff').select('mfa_enabled').eq('user_id',login.user!.id).single(),
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      const requiresMfa = !account || account.mfa_enabled;
      if (requiresMfa && assurance?.currentLevel !== 'aal2') return {ok:true,message:'Confirme o acesso com seu aplicativo autenticador.',redirect:'/seguranca'};
    }
    return {ok:true,message:'Acesso confirmado.',redirect:staff?'/rh':'/candidato'};
  } catch (error) {
    if (error instanceof z.ZodError) return {ok:false,message:'Verifique os campos. A senha deve ter entre 12 e 128 caracteres.'};
    log('auth.request_failed', { code: 'unexpected_error' });
    return {ok:false,message:'Não foi possível conectar ao serviço de autenticação. Tente novamente ou procure o administrador.'};
  }
}
export async function microsoft() {
  if(!isConfigured()) redirect('/entrar?erro=configuracao');
  const client=await db();
  const {data,error}=await client.auth.signInWithOAuth({provider:'azure',options:{scopes:'email',redirectTo:`${config.url}/auth/callback?next=/rh`}});
  if(error || !data.url) redirect('/entrar?erro=microsoft');
  redirect(data.url);
}
export async function logout() { const client=await db(); await client.auth.signOut(); redirect('/entrar'); }
