import Link from '@/ui/link';
import { Brand } from './brand';
import { Avatar } from './common';
import { Icon } from './icon';
import { Navigation, type NavGroup } from './navigation';
import { logout } from '@/modules/auth/actions';
import { NavigationContent } from './pending-feedback';
import { SubmitButton } from './submit-button';
export function WorkspaceShell({ children, name, groups, staff=false }: {children:React.ReactNode;name:string;groups:NavGroup[];staff?:boolean}) {
  return <div className="shell">
    <aside className="sidebar"><div className="sidebar-header"><Brand compact/></div><div className="sidebar-scroll"><Navigation groups={groups}/></div>
      <div className="sidebar-bottom"><Link className="nav-link" href="/vagas"><Icon name="open_in_new"/>Portal de carreiras</Link><form action={logout}><SubmitButton className="button text" pendingLabel="Saindo…"><Icon name="logout"/>Sair da conta</SubmitButton></form></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="mobile-brand"><Brand compact/></div><span className="topbar-title">{staff?'GESTÃO DE PESSOAS / RECRUTAMENTO':'MINHA CARREIRA / HERBAMED'}</span><div className="topbar-actions"><Link href={staff?'/rh/mensagens':'/candidato/mensagens'} aria-label="Mensagens" className="text-link"><Icon name="notifications_none"/></Link><div className="user-info"><Avatar name={name}/><div><strong>{name}</strong><small>{staff?'Equipe Herbamed':'Área do candidato'}</small></div></div></div></header>
      <details className="mobile-nav"><summary><Icon name="menu"/>Menu de navegação</summary><Navigation groups={groups}/><form action={logout}><SubmitButton className="button text" pendingLabel="Saindo…">Sair da conta</SubmitButton></form></details>
      <NavigationContent>{children}</NavigationContent>
    </div>
  </div>;
}
