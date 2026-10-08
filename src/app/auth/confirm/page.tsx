import { Brand } from '@/ui/brand';
import { ActionForm, Hidden } from '@/ui/form';
import { confirmationSchema } from '@/modules/email/auth-messages';
import { confirmEmail } from '@/modules/auth/confirm-email';
import Link from '@/ui/link';

export default async function ConfirmPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = confirmationSchema.safeParse(await searchParams);
  // Reading the link never consumes it. Microsoft Safe Links and other scanners
  // may open GET requests before the recipient; verification requires a POST.
  return <div className="auth-page">
    <aside className="auth-aside"><Brand /><h1>Seu próximo passo<br /><em>começa aqui.</em></h1></aside>
    <main id="conteudo" className="auth-form">
      <h2>Confirme sua solicitação</h2>
      {input.success ? <>
        <p className="muted">Clique abaixo para confirmar {input.data.type === 'recovery'
          ? 'a recuperação da senha' : input.data.type === 'email_change' ? 'a alteração do e-mail' : 'seu acesso'}.</p>
        <ActionForm action={confirmEmail} submit="Confirmar e continuar">
          <Hidden name="token_hash" value={input.data.token_hash} />
          <Hidden name="type" value={input.data.type} />
        </ActionForm>
      </> : <p role="alert">O link está incompleto ou é inválido. Solicite uma nova mensagem.</p>}
      <div className="auth-links"><Link href="/entrar">Voltar para entrar</Link></div>
    </main>
  </div>;
}
