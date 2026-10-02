import { requireStaff } from '@/modules/auth/session';
import { WorkspaceShell } from '@/ui/workspace-shell';
import type { NavGroup } from '@/ui/navigation';
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  const {client,user}=await requireStaff();
  const checks=[['dashboard.read','/rh','Dashboard','space_dashboard','VISÃO GERAL'],['jobs.read','/rh/vagas','Vagas','work_outline','RECRUTAMENTO'],['applications.read','/rh/candidaturas','Candidaturas','assignment','RECRUTAMENTO'],['interviews.read','/rh/entrevistas','Entrevistas','event','RECRUTAMENTO'],['candidates.read','/rh/candidatos','Candidatos','group','TALENTOS'],['candidates.read','/rh/talentos','Banco de talentos','person_search','TALENTOS'],['messages.read','/rh/mensagens','Mensagens','chat_bubble_outline','COMUNICAÇÃO'],['reports.read','/rh/relatorios','Indicadores','bar_chart','RELATÓRIOS'],['users.manage','/rh/usuarios','Usuários','admin_panel_settings','ADMINISTRAÇÃO'],['roles.manage','/rh/permissoes','Perfis de acesso','key','ADMINISTRAÇÃO'],['settings.manage','/rh/configuracoes','Configurações','settings','ADMINISTRAÇÃO'],['privacy.manage','/rh/privacidade','Solicitações LGPD','shield','PRIVACIDADE E SEGURANÇA'],['audit.read','/rh/auditoria','Auditoria','history','PRIVACIDADE E SEGURANÇA']] as const;
  const {data:permissions}=await client.rpc('staff_navigation_permissions');
  const allowed=checks.map(item=>({item,yes:permissions?.includes(item[0])===true}));
  const groups:NavGroup[]=[];
  for(const {item,yes} of allowed)if(yes){let group=groups.find(g=>g.label===item[4]);if(!group){group={label:item[4],items:[]};groups.push(group);}group.items.push({href:item[1],label:item[2],icon:item[3]});}
  groups.push({label:'CONFIGURAÇÕES',items:[{href:'/rh/conta',label:'Conta',icon:'manage_accounts'}]});
  const {data:staff}=await client.from('staff').select('display_name').eq('user_id',user.id).maybeSingle();
  return <WorkspaceShell staff name={staff?.display_name||user.email||'Equipe Herbamed'} groups={groups}>{children}</WorkspaceShell>;
}
