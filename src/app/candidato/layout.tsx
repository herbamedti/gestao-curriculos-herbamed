import { session } from '@/modules/auth/session';
import { WorkspaceShell } from '@/ui/workspace-shell';
export default async function CandidateLayout({children}:{children:React.ReactNode}) {
  const {client,user}=await session();
  const {data}=await client.from('candidates').select('full_name').eq('user_id',user.id).maybeSingle();
  return <WorkspaceShell name={data?.full_name || user.user_metadata.full_name || 'Minha conta'} groups={[{label:'MINHA TRAJETÓRIA',items:[{label:'Visão geral',href:'/candidato',icon:'space_dashboard'},{label:'Meu currículo',href:'/candidato/perfil',icon:'account_circle'},{label:'Minhas candidaturas',href:'/candidato/candidaturas',icon:'work_outline'},{label:'Mensagens',href:'/candidato/mensagens',icon:'chat_bubble_outline'}]},{label:'MINHA CONTA',items:[{label:'Privacidade',href:'/candidato/privacidade',icon:'shield'}]},{label:'CONFIGURAÇÕES',items:[{label:'Conta',href:'/candidato/conta',icon:'manage_accounts'}]}]}>{children}</WorkspaceShell>;
}
