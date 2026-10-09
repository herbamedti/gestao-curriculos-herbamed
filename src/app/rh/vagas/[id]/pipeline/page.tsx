import Link from '@/ui/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Empty, date } from '@/ui/common';
import { ActionForm, Hidden, Select } from '@/ui/form';
import { mutate } from '@/modules/actions';
import { StaffPermission } from '@/modules/auth/permission-gate';
export default async function Pipeline({params}:{params:Promise<{id:string}>}) {
  const id=(await params).id;const {client}=await requirePermission('applications.read',id);
  const [{data:job},{data:stages},{data:apps}]=await Promise.all([client.from('jobs').select('id,title').eq('id',id).maybeSingle(),client.from('job_stages').select('id,name,position').eq('job_id',id).order('position'),client.from('applications').select('id,candidate_id,stage_id,created_at,status').eq('job_id',id).eq('status','active').order('created_at',{ascending:false}).limit(200)]);
  if(!job)notFound();
  const ids=apps?.map(a=>a.candidate_id)||[];
  const people=ids.length?(await client.from('candidates').select('id,full_name,city,headline').in('id',ids)).data:[];
  return <><PageHeading eyebrow="RECRUTAMENTO / PIPELINE" title={job.title} description="Mova pessoas entre etapas com histórico automático."><Link href={`/rh/vagas/${id}`} className="button outlined">Configurar vaga</Link></PageHeading>{stages?.length?<div className="pipeline">{stages.map(stage=><section className="pipeline-column" key={stage.id}><h2>{stage.name} <span>{apps?.filter(a=>a.stage_id===stage.id).length||0}</span></h2>{apps?.filter(a=>a.stage_id===stage.id).map(a=>{const person=people?.find(p=>p.id===a.candidate_id);return <article className="pipeline-card" key={a.id}><Link href={`/rh/candidaturas/${a.id}`}><strong>{person?.full_name||'Candidato'}</strong><p className="muted">{person?.headline||person?.city||'Perfil'}</p><small>{date(a.created_at)}</small></Link><StaffPermission permission="applications.move" jobId={id}><ActionForm action={mutate} submit="Mover" confirm="Mover esta candidatura? A alteração será registrada e o candidato receberá uma atualização."><Hidden name="op" value="move"/><Hidden name="application_id" value={a.id}/><Hidden name="expected_stage" value={a.stage_id}/><Select name="stage_id" label="Mover para"><option value="">Selecione etapa</option>{stages.filter(s=>s.id!==stage.id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></ActionForm></StaffPermission></article>})}{!apps?.some(a=>a.stage_id===stage.id)&&<p className="muted">Nenhuma candidatura nesta etapa.</p>}</section>)}</div>:<Empty title="Pipeline não configurado" description="Adicione etapas à vaga para acompanhar candidaturas." href={`/rh/vagas/${id}`} action="Configurar etapas"/>}</>;
}
