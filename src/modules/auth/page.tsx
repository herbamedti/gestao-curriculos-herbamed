import Link from '@/ui/link';
import Image from 'next/image';
import { Brand } from '@/ui/brand';
import { ActionForm, Field, Hidden } from '@/ui/form';
import { authenticate, microsoft, google } from './actions';
import { Captcha } from '@/ui/captcha';
import { Icon } from '@/ui/icon';
import { config, features } from '@/lib/config';
import { SignupFields } from './signup-fields';
import { SubmitButton } from '@/ui/submit-button';
export function AuthPage({ mode, error, registrationPending = false, staffReady = false }: { mode:'login'|'signup'|'recover'|'password'; error?:string; registrationPending?:boolean; staffReady?:boolean }) {
  const titles={login:'Boas-vindas de volta.',signup:'Sua trajetória começa aqui.',recover:'Recupere seu acesso.',password:'Defina uma nova senha.'};
  const subtitles={login:'Entre para acompanhar suas próximas oportunidades.',signup:'Crie sua conta e dê o próximo passo com a Herbamed.',recover:'Enviaremos as instruções para o seu e-mail.',password:'Use pelo menos 12 caracteres para proteger sua conta.'};
  const emailFlowDisabled = !features.email && (mode === 'recover' || mode === 'password');
  return <div className="auth-page">
    <aside className="auth-aside"><Brand /><h1>Talentos que<br />transformam.<br /><em>Histórias que<br />crescem juntas.</em></h1><p>Um espaço para sua experiência, suas ideias e tudo o que você ainda quer construir.</p></aside>
    <main id="conteudo" className="auth-form">
      <h2>{titles[mode]}</h2>
      <p className="muted">{emailFlowDisabled ? 'A recuperação por e-mail está temporariamente desativada. Procure o administrador para recuperar seu acesso.' : subtitles[mode]}</p>
      {error && <p role="alert" className="alert danger">{error==='google-equipe'?'O login Google é destinado aos candidatos. Para acessar a gestão, use seu método de acesso interno autorizado.':'O acesso não pôde ser concluído. Verifique a configuração com a equipe responsável.'}</p>}
      {features.google&&(mode==='login'||mode==='signup')&&<div className="google-login"><ActionForm action={google} pendingLabel="Conectando ao Google…" submit={<><Image src="/brand/google-g.png" width={20} height={20} alt=""/><span>Continuar com Google</span></>} className="google-login-form"><Captcha siteKey={features.turnstile?process.env.TURNSTILE_SITE_KEY:undefined}/></ActionForm><p className="muted">Para candidatos. No primeiro acesso, CPF e data de nascimento também são obrigatórios.</p><div className="divider">OU CONTINUE COM E-MAIL</div></div>}
      {!emailFlowDisabled && <ActionForm action={authenticate} pendingLabel={{login:'Entrando…',signup:'Criando conta…',recover:'Enviando instruções…',password:'Atualizando senha…'}[mode]} submit={{login:'Entrar',signup:'Criar minha conta',recover:'Enviar instruções',password:'Salvar nova senha'}[mode]}>
        <Hidden name="mode" value={mode}/>
        {mode!=='password' && <Field name="email" label="E-mail" type="email" required autoComplete="email" maxLength={254}/>}
        {mode==='signup' && <SignupFields />}
        {mode!=='recover' && <Field name="password" label="Senha" type="password" required minLength={12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'}/>}
        <Captcha siteKey={features.turnstile ? process.env.TURNSTILE_SITE_KEY : undefined}/>
        {mode==='signup' && <p className="muted">Ao continuar, você pode consultar como seus dados são tratados no <Link className="text-link" href="/privacidade">aviso de privacidade</Link>.</p>}
        {mode==='login' && registrationPending && <div role="status" className="alert success">Confira seu e-mail para confirmar a conta. Se já possui cadastro, entre ou recupere a sua senha.</div>}
        {mode==='login' && staffReady && <div role="status" className="alert success">Seu acesso está pronto. Entre com o e-mail e a senha que você criou.</div>}
      </ActionForm>}
      <div className="auth-links">
        <Link href={mode==='login'?'/criar-conta':'/entrar'}>{mode==='login'?'Ainda não tenho conta':'Voltar para entrar'}</Link>
        {mode==='login' && features.email && <Link href="/recuperar-senha">Esqueci minha senha</Link>}
      </div>
      {mode==='login' && <>
        <div className="divider">EQUIPE HERBAMED</div>
        <p className="muted">{config.environment === 'demo' ? 'Administradores autorizados também podem entrar com e-mail e senha acima. Confirme o acesso com seu aplicativo autenticador.' : 'Use sua conta corporativa. O acesso interno depende de autorização.'}</p>
        {config.environment !== 'demo' && <form action={microsoft}><SubmitButton className="button outlined" pendingLabel="Conectando à Microsoft…" style={{width:'100%'}}><Icon name="corporate_fare"/>Entrar com Microsoft</SubmitButton></form>}
      </>}
    </main>
  </div>;
}
