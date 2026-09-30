import Link from 'next/link';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Empty, date } from '@/ui/common';
export default async function Messages({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const {client}=await requirePermission('messages.read');const page=Math.max(1,Math.min(1000,Number((await searchParams).page)||1));
  const {data,count}=await client.from('messages').select('*',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*20,page*20-1);
  const ids=data?.map(m=>m.candidate_id)||[];
  const people=ids.length?(await client.from('candidates').select('id,full_name').in('id',ids)).data:[];
  return <><PageHeading eyebrow="COMUNICAÇÃO" title="Mensagens" description="Histórico de conversas com candidatos."/><div className="card">{data?.length?data.map(m=><div className="file-row" key={m.id}><div><strong>{m.subject}</strong><br/><small>{people?.find(p=>p.id===m.candidate_id)?.full_name||'Candidato'} · {date(m.created_at,true)}</small><p className="muted">{m.body.slice(0,180)}{m.body.length>180?'…':''}</p></div><Link className="text-link" href={`/rh/candidatos/${m.candidate_id}`}>Abrir perfil</Link></div>):<Empty title="Nenhuma mensagem" description="As mensagens aparecerão quando houver conversas." icon="chat_bubble_outline"/>}</div><div className="pagination">{page>1&&<Link href={`?page=${page-1}`}>Anterior</Link>}<span>{count||0} mensagens</span>{page*20<(count||0)&&<Link href={`?page=${page+1}`}>Próxima</Link>}</div></>;
}
