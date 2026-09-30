import Link from 'next/link';
import { Brand } from './brand';
import { Icon } from './icon';
import { config } from '@/lib/config';
export function PublicShell({ children }: { children: React.ReactNode }) {
  return <><header className="public-header"><Brand /><nav aria-label="Navegação principal"><Link href="/vagas">Nossas vagas</Link><Link href="/banco-de-talentos">Banco de talentos</Link><Link className="button outlined" href="/candidato">Minha área <Icon name="arrow_forward" /></Link></nav></header><main id="conteudo">{children}</main><footer className="public-footer"><Brand /><p>Talentos que fazem a diferença.</p><div><Link href="/privacidade">Privacidade</Link><Link href="/entrar?perfil=rh">Acesso RH</Link><span>© {new Date().getFullYear()} {config.name}</span></div></footer></>;
}
