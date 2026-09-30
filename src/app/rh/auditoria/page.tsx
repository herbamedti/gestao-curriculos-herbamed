import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Empty, date } from '@/ui/common';
export default async function Audit() {
  const {client}=await requirePermission('audit.read');
  const {data}=await client.from('audit_events').select('*').order('created_at',{ascending:false}).limit(100);
  return <><PageHeading eyebrow="PRIVACIDADE E SEGURANÇA" title="Auditoria" description="Alterações e acessos sensíveis recentes. Logs não incluem currículos ou tokens."/><div className="card">{data?.length?<div className="table-wrap"><table><thead><tr><th>Data</th><th>Ação</th><th>Recurso</th><th>Identificador</th><th>Usuário</th></tr></thead><tbody>{data.map(e=><tr key={e.id}><td>{date(e.created_at,true)}</td><td>{e.action}</td><td>{e.resource}</td><td>{e.resource_id||'—'}</td><td>{e.actor_id||'Sistema'}</td></tr>)}</tbody></table></div>:<Empty title="Sem eventos registrados" description="As operações auditáveis aparecerão aqui." icon="history"/>}</div></>;
}
