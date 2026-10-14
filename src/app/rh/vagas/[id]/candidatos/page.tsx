import Form from 'next/form';
import Link from '@/ui/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { SubmitButton } from '@/ui/submit-button';
import { jobCandidateList } from '@/modules/jobs/candidate-management-schema';
import { JobCandidatePanel } from '@/modules/jobs/candidate-management-panel';

export default async function JobCandidates({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{q?:string;stage?:string;status?:string;page?:string}>}) {
  const id=(await params).id;if(!z.uuid().safeParse(id).success)notFound();
  const {client}=await requirePermission('applications.read',id);await requirePermission('candidates.read',id);
  const p=await searchParams;const page=Math.max(1,Math.min(10000,Math.floor(Number(p.page)||1)));
  const status=z.enum(['all','linked','active','withdrawn','closed','unlinked']).catch('linked').parse(p.status);
  const stage=z.uuid().safeParse(p.stage);const q=(p.q||'').trim().slice(0,100);
  const [jobResult,stagesResult,result,link,move,unlink]=await Promise.all([
    client.from('jobs').select('id,title,code,status,visibility,deadline').eq('id',id).maybeSingle(),
    client.from('job_stages').select('id,name,terminal').eq('job_id',id).order('position'),
    client.rpc('list_job_candidates',{p_job_id:id,p_search:q,p_status:status,p_page:page,...(stage.success?{p_stage_id:stage.data}:{})}),
    client.rpc('has_permission',{p_permission:'applications.link',p_job_id:id}),client.rpc('has_permission',{p_permission:'applications.move',p_job_id:id}),client.rpc('has_permission',{p_permission:'applications.unlink',p_job_id:id}),
  ]);
  if(jobResult.error)return <p className="alert danger" role="alert">Não foi possível carregar esta vaga. Tente novamente.</p>;
  const job=jobResult.data;if(!job)notFound();const parsed=jobCandidateList.safeParse(result.data);
  const list=parsed.success?parsed.data:null;const base=`/rh/vagas/${id}/candidatos`;
  const url=(target:number)=>`${base}?${new URLSearchParams({q,status,stage:stage.success?stage.data:'',page:String(target)})}`;
  return <><PageHeading eyebrow="RECRUTAMENTO / CANDIDATOS DA VAGA" title={job.title} description={`Código ${job.code} · Consulte inscrições e gerencie os vínculos desta vaga.`}>
    <Link href={`/rh/vagas/${id}`} className="button outlined">Dados da vaga</Link><Link href={`/rh/vagas/${id}/pipeline`} className="button tonal">Ver pipeline</Link>
  </PageHeading>
  {list&&<div className="job-candidate-summary" aria-label="Resumo desta vaga"><div className="card"><span>Vínculos atuais</span><strong>{list.linked}</strong></div><div className="card"><span>Em andamento</span><strong>{list.active}</strong></div><div className="card"><span>Desvinculados</span><strong>{list.unlinked}</strong></div></div>}
  <section className="card admin-register"><Form action={base} className="job-candidate-filters"><label className="field"><span>Buscar candidato</span><input type="search" name="q" defaultValue={q} maxLength={100} placeholder="Nome, e-mail ou área"/></label>
    <label className="field"><span>Etapa</span><select name="stage" defaultValue={stage.success?stage.data:''}><option value="">Todas as etapas</option>{stagesResult.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label className="field"><span>Situação</span><select name="status" defaultValue={status}><option value="linked">Vínculos atuais</option><option value="active">Em andamento</option><option value="closed">Encerradas</option><option value="withdrawn">Retiradas pelo candidato</option><option value="unlinked">Desvinculadas</option><option value="all">Todas, incluindo histórico</option></select></label>
    <SubmitButton className="button primary" pendingLabel="Filtrando…">Filtrar</SubmitButton><Link href={base} className="text-link">Limpar filtros</Link>
  </Form>
  {result.error||!list||stagesResult.error?<p role="alert" className="alert danger">Não foi possível carregar os candidatos desta vaga. Recarregue para tentar novamente.</p>:<>
    <JobCandidatePanel jobId={id} rows={list.rows} stages={stagesResult.data||[]} canLink={link.data===true} canMove={move.data===true} canUnlink={unlink.data===true} linkAvailable={job.status==='published'&&job.visibility==='public'&&(!job.deadline||new Date(job.deadline)>new Date())&&!!stagesResult.data?.length}/>
    <nav className="pagination" aria-label="Páginas dos candidatos">{page>1&&<Link href={url(page-1)}>Anterior</Link>}<span>{list.total} candidatos encontrados · Página {page}</span>{page*20<list.total&&<Link href={url(page+1)}>Próxima</Link>}</nav>
  </>}
  </section></>;
}
