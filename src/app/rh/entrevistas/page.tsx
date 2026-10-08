import Link from '@/ui/link';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Empty, Badge, date, statusLabels } from '@/ui/common';
export default async function Interviews({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const {client}=await requirePermission('interviews.read');const page=Math.max(1,Math.min(1000,Number((await searchParams).page)||1));
  const {data,count}=await client.from('interviews').select('*',{count:'exact'}).order('starts_at',{ascending:true}).range((page-1)*20,page*20-1);
  const ids=data?.map(i=>i.application_id)||[];
  const apps=ids.length?(await client.from('applications').select('id,candidate_id,job_id').in('id',ids)).data:[];
  const cids=apps?.map(a=>a.candidate_id)||[],jids=apps?.map(a=>a.job_id)||[];
  const [people,jobs]=await Promise.all([cids.length?client.from('candidates').select('id,full_name').in('id',cids):Promise.resolve({data:[]}),jids.length?client.from('jobs').select('id,title').in('id',jids):Promise.resolve({data:[]})]);
  return <><PageHeading eyebrow="RECRUTAMENTO" title="Entrevistas" description="Agenda e histórico de entrevistas."/><div className="card">{data?.length?<div className="table-wrap"><table><thead><tr><th>Data e hora</th><th>Candidato</th><th>Vaga</th><th>Local / link</th><th>Status</th></tr></thead><tbody>{data.map(i=>{const app=apps?.find(a=>a.id===i.application_id);return <tr key={i.id}><td>{date(i.starts_at,true)}</td><td><Link className="text-link" href={`/rh/candidaturas/${i.application_id}`}>{people.data?.find(p=>p.id===app?.candidate_id)?.full_name||'Candidato'}</Link></td><td>{jobs.data?.find(j=>j.id===app?.job_id)?.title||'—'}</td><td>{i.location}</td><td><Badge>{statusLabels[i.status]||i.status}</Badge></td></tr>})}</tbody></table></div>:<Empty title="Nenhuma entrevista agendada" description="Agende entrevistas pelo perfil da candidatura." href="/rh/candidaturas" action="Ver candidaturas" icon="event"/>}</div><div className="pagination">{page>1&&<Link href={`?page=${page-1}`}>Anterior</Link>}<span>{count||0} entrevistas</span>{page*20<(count||0)&&<Link href={`?page=${page+1}`}>Próxima</Link>}</div></>;
}
