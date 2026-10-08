import { SubmitButton } from '@/ui/submit-button';
import Link from '@/ui/link';
import { logout } from '@/modules/auth/actions';
export default function UnavailableAccount() {
  return <main id="conteudo" className="container narrow page-section"><div className="card form"><h1>Acesso à conta indisponível</h1><p>Seu acesso foi desativado pela administração ou esta sessão não está mais autorizada. Se o acesso já foi reativado, saia e entre novamente.</p><p className="muted">Para solicitar uma revisão, procure a equipe de RH da Herbamed.</p><div className="actions"><form action={logout}><SubmitButton className="button primary" pendingLabel="Saindo…">Sair e voltar ao login</SubmitButton></form><Link className="button outlined" href="/vagas">Consultar vagas públicas</Link></div></div></main>;
}
