import Link from '@/ui/link';
import { session } from '@/modules/auth/session';
import { PageHeading, Empty, Badge, date, statusLabels } from '@/ui/common';
import { ActionForm, Hidden } from '@/ui/form';
import { mutate } from '@/modules/actions';
export default async function MyApplications() {
  const {client,user}=await session();
  const {data:profile}=await client.from('candidates').select('id').eq('user_id',user.id).maybeSingle();
  const {data:apps}=profile?await client.from('applications').select('id,job_id,stage_id,status,created_at').eq('candidate_id',profile.id).order('created_at',{ascending:false}):{data:[]};
  const jobIds=apps?.map(a=>a.job_id)||[];
  const stageIds=apps?.map(a=>a.stage_id)||[];
  const [jobs,stages]=await Promise.all([jobIds.length?client.from('jobs').select('id,title,slug,city').in('id',jobIds):Promise.resolve({data:[]}),stageIds.length?client.from('job_stages').select('id,name').in('id',stageIds):Promise.resolve({data:[]})]);
  return <><PageHeading eyebrow="ACOMPANHAMENTO" title="Minhas candidaturas" description="Acompanhe cada processo no seu tempo."/><div className="card">{apps?.length?<div className="table-wrap"><table><thead><tr><th>Vaga</th><th>Etapa atual</th><th>Enviada em</th><th>Status</th><th>Ações</th></tr></thead><tbody>{apps.map(a=>{const job=jobs.data?.find(j=>j.id===a.job_id);return <tr key={a.id}><td><strong>{job?.title||'Vaga indisponível'}</strong><small>{job?.city}</small></td><td>{stages.data?.find(s=>s.id===a.stage_id)?.name||'—'}</td><td>{date(a.created_at)}</td><td><Badge>{statusLabels[a.status]||a.status}</Badge></td><td>{a.status==='active'&&<ActionForm action={mutate} submit="Retirar" confirm="Retirar sua candidatura desta vaga? Esta ação será registrada."><Hidden name="op" value="withdraw"/><Hidden name="application_id" value={a.id}/></ActionForm>}</td></tr>})}</tbody></table></div>:<Empty title="Nenhuma candidatura ainda" description="Encontre uma vaga e dê o próximo passo." href="/vagas" action="Explorar vagas" icon="work_outline"/>}</div><Link className="text-link" href="/vagas">Explorar oportunidades</Link></>;
}
