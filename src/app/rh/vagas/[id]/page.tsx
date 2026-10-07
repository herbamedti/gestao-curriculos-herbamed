import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Badge, statusLabels } from '@/ui/common';
import { JobEditor } from '@/modules/jobs/editor';
import { StageEditor, QuestionEditor } from '@/modules/jobs/process-editor';
import { ActionForm, Hidden, Select } from '@/ui/form';
import { mutate } from '@/modules/actions';
export default async function ManageJob({params}:{params:Promise<{id:string}>}) {
  const id=(await params).id;const {client}=await requirePermission('jobs.read',id);
  const [{data:job},{data:departments},{data:stages},{data:questions},{data:levels},{data:types}]=await Promise.all([client.from('jobs').select('*').eq('id',id).maybeSingle(),client.from('departments').select('id,name').eq('active',true),client.from('job_stages').select('*').eq('job_id',id).order('position'),client.from('job_questions').select('*').eq('job_id',id).order('position'),client.from('experience_levels').select('id,name,active').order('name'),client.from('employment_types').select('id,name,active').order('name')]);
  if(!job)notFound();
  return <><PageHeading eyebrow="RECRUTAMENTO / VAGAS" title={job.title} description={`Código ${job.code} · ${job.city}`}><Badge tone={job.status}>{statusLabels[job.status]}</Badge>{job.status==='published'&&<Link className="button outlined" href={`/vagas/${job.slug}`}>Ver no portal</Link>}<Link className="button tonal" href={`/rh/vagas/${id}/pipeline`}>Abrir pipeline</Link></PageHeading><div className="split"><div><JobEditor job={job} departments={departments||[]} experienceLevels={levels||[]} employmentTypes={types||[]}/><StageEditor jobId={id} stages={(stages||[]).map(({id,name,terminal})=>({id,name,terminal}))}/><QuestionEditor jobId={id} questions={questions||[]}/></div><aside className="card"><h2>Publicação</h2><p className="muted">Vagas publicadas aparecem no portal e aceitam candidaturas até o prazo configurado.</p><ActionForm action={mutate} submit="Atualizar status" confirm={job.status==='published'?'Alterar o status desta vaga? Novas candidaturas podem ser interrompidas.':undefined}><Hidden name="op" value="job-status"/><Hidden name="job_id" value={id}/><Select name="status" label="Status" value={job.status} required>{['draft','pending','published','paused','closed','cancelled','archived'].map(s=><option value={s} key={s}>{statusLabels[s]}</option>)}</Select></ActionForm></aside></div></>;
}
