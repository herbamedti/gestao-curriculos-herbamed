import { SubmitButton } from '@/ui/submit-button';
import Link from '@/ui/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { features } from '@/lib/config';
import { completeGoogleRegistration, logout } from '@/modules/auth/actions';
import { SignupFields } from '@/modules/auth/signup-fields';
import { ActionForm } from '@/ui/form';
import { PageHeading } from '@/ui/common';
import { PublicShell } from '@/ui/public-shell';
import { Captcha } from '@/ui/captcha';

export default async function CompleteRegistration() {
  const client=await db();
  const {data:{user}}=await client.auth.getUser();
  if(!user)redirect('/entrar');
  const status=await client.rpc('candidate_registration_status');
  if(status.error||status.data==='unavailable')redirect('/conta-indisponivel');
  if(status.data==='complete')redirect('/candidato');
  if(status.data!=='required')redirect('/entrar');
  return <PublicShell><div className="container narrow page-section">
    <PageHeading eyebrow="CONCLUIR CADASTRO" title="Complete seus dados" description="Sua conta Google foi autenticada. Informe os dados obrigatórios para acessar o portal de candidatos."/>
    <section className="card google-registration"><p className="muted">Conta autenticada: <strong>{user.email}</strong></p>
      <ActionForm action={completeGoogleRegistration} submit="Concluir cadastro"><SignupFields preserveValues/><Captcha siteKey={features.turnstile?process.env.TURNSTILE_SITE_KEY:undefined}/><p className="muted">Consulte como seus dados são tratados no <Link className="text-link" href="/privacidade">aviso de privacidade</Link>.</p></ActionForm>
      <form action={logout}><SubmitButton className="button outlined" pendingLabel="Saindo…">Sair e usar outra conta</SubmitButton></form>
    </section>
  </div></PublicShell>;
}
