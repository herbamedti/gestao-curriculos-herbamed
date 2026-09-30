import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
export default async function Reports() {
  const {client}=await requirePermission('reports.read');
  const [{data:stages},{data:jobs}]=await Promise.all([client.from('job_stages').select('id,name').limit(1000),client.from('jobs').select('id,status').limit(1000)]);
  const {data:apps}=await client.from('applications').select('stage_id,status').limit(1000);
  const counts=new Map<string,number>();for(const a of apps||[])counts.set(a.stage_id,(counts.get(a.stage_id)||0)+1);
  const funnel=Array.from(new Set((stages||[]).map(s=>s.name))).map(name=>({name,count:(stages||[]).filter(s=>s.name===name).reduce((sum,s)=>sum+(counts.get(s.id)||0),0)})).sort((a,b)=>b.count-a.count);
  const max=Math.max(1,...funnel.map(f=>f.count));
  return <><PageHeading eyebrow="RELATÓRIOS" title="Indicadores" description="Visão agregada para orientar decisões de recrutamento."/><div className="metrics"><div className="metric"><div className="metric-top">Vagas no período</div><strong>{jobs?.length||0}</strong></div><div className="metric"><div className="metric-top">Publicadas</div><strong>{jobs?.filter(j=>j.status==='published').length||0}</strong></div><div className="metric"><div className="metric-top">Candidaturas</div><strong>{apps?.length||0}</strong></div><div className="metric"><div className="metric-top">Em andamento</div><strong>{apps?.filter(a=>a.status==='active').length||0}</strong></div></div><div className="card"><h2>Candidaturas por etapa</h2><p className="muted">Este recorte inclui até 1.000 registros acessíveis ao seu perfil.</p>{funnel.length?funnel.map(row=><div className="funnel-row" key={row.name}><span>{row.name}</span><div className="progress-track"><span style={{width:`${row.count/max*100}%`}}/></div><strong>{row.count}</strong></div>):<p>Nenhum dado para exibir.</p>}</div></>;
}
