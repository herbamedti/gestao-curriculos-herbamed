import Link from 'next/link';
import { Brand } from './brand';
import { Avatar } from './common';
import { Icon } from './icon';
import { Navigation, type NavGroup } from './navigation';
import { logout } from '@/modules/auth/actions';
export function WorkspaceShell({ children, name, groups, staff=false }: {children:React.ReactNode;name:string;groups:NavGroup[];staff?:boolean}) {
  return <div className="shell"><aside className="sidebar"><Brand compact/><Navigation groups={groups}/><div className="sidebar-bottom"><Link className="nav-link" href="/vagas"><Icon name="open_in_new"/>Portal de carreiras</Link><form action={logout}><button className="button text"><Icon name="logout"/>Sair da conta</button></form></div></aside><div className="workspace"><header className="topbar"><span className="topbar-title">{staff?'GESTÃO DE PESSOAS / RECRUTAMENTO':'MINHA CARREIRA / HERBAMED'}</span><div className="topbar-actions"><Link href={staff?'/rh/mensagens':'/candidato/mensagens'} aria-label="Mensagens" className="text-link"><Icon name="notifications_none"/></Link><div className="user-info"><Avatar name={name}/><div><strong>{name}</strong><small>{staff?'Equipe Herbamed':'Área do candidato'}</small></div></div></div></header><details className="mobile-nav"><summary><Icon name="menu"/>Menu de navegação</summary><Navigation groups={groups}/><form action={logout}><button className="button text">Sair da conta</button></form></details><main className="workspace-content" id="conteudo">{children}</main></div></div>;
}
