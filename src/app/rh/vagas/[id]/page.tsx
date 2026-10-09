import Link from '@/ui/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Badge, statusLabels } from '@/ui/common';
import { JobEditor } from '@/modules/jobs/editor';
import { StageEditor, QuestionEditor } from '@/modules/jobs/process-editor';
import { jobItems } from '@/modules/jobs/items';
import { ActionForm, Hidden, Select } from '@/ui/form';
import { mutate } from '@/modules/actions';
export default async function ManageJob({params}:{params:Promise<{id:string}>}) {
  const id=(await params).id;const {client}=await requirePermission('jobs.read',id);
  const [{data:job},{data:departments},{data:stages},{data:questions},{data:levels},{data:types},edit,publish,pipeline]=await Promise.all([
    client.from('jobs').select('*').eq('id',id).maybeSingle(),client.from('departments').select('id,name').eq('active',true),
    client.from('job_stages').select('*').eq('job_id',id).order('position'),client.from('job_questions').select('*').eq('job_id',id).order('position'),
    client.from('experience_levels').select('id,name,active').order('name'),client.from('employment_types').select('id,name,active').order('name'),
    client.rpc('has_permission',{p_permission:'jobs.manage',p_job_id:id}),client.rpc('has_permission',{p_permission:'jobs.publish',p_job_id:id}),client.rpc('has_permission',{p_permission:'applications.read',p_job_id:id}),
  ]);
  if(!job)notFound();
  return <><PageHeading eyebrow="RECRUTAMENTO / VAGAS" title={job.title} description={`Código ${job.code} · ${job.city}`}>
    <Badge tone={job.status}>{statusLabels[job.status]}</Badge>{job.status==='published'&&<Link className="button outlined" href={`/vagas/${job.slug}`}>Ver no portal</Link>}
    {pipeline.data&&<Link className="button tonal" href={`/rh/vagas/${id}/pipeline`}>Abrir pipeline</Link>}
  </PageHeading><div className="split"><div>{edit.data ? <>
    <JobEditor job={job} departments={departments||[]} experienceLevels={levels||[]} employmentTypes={types||[]}/>
    <StageEditor jobId={id} stages={(stages||[]).map(({id,name,terminal})=>({id,name,terminal}))}/><QuestionEditor jobId={id} questions={questions||[]}/>
  </> : <>
    <section className="card"><h2>Dados da oportunidade</h2><p className="muted">Seu acesso permite consultar esta vaga.</p><p>{job.city} / {job.state} · {job.work_model} · {job.contract_type}</p><h3>Descrição</h3><p className="detail-body">{job.description}</p>
      {([['Responsabilidades',job.responsibilities],['Requisitos',job.requirements],['Benefícios',job.benefits]] as const).map(([label,value])=>value&&<section key={label}><h3>{label}</h3><ul>{jobItems(value).map((item,index)=><li key={index}>{item}</li>)}</ul></section>)}
    </section><section className="card"><h2>Etapas do processo</h2><ol>{stages?.map(stage=><li key={stage.id}>{stage.name}{stage.terminal?' · Final':''}</li>)}</ol></section>
    <section className="card"><h2>Perguntas da candidatura</h2>{questions?.length ? questions.map(question=><div className="message" key={question.id}><strong>{question.label}</strong><p>{question.required?'Obrigatória':'Opcional'} · {question.kind==='choice'?'Opção':'Texto'}</p>{question.kind==='choice'&&<ul>{(Array.isArray(question.options)?question.options:[]).map((option,index)=><li key={index}>{String(option)}</li>)}</ul>}</div>) : <p className="muted">Nenhuma pergunta cadastrada.</p>}</section>
  </>}</div><aside className="card"><h2>Publicação</h2><p className="muted">Vagas publicadas aparecem no portal e aceitam candidaturas até o prazo configurado.</p>
    {publish.data ? <ActionForm action={mutate} submit="Atualizar status" confirm={job.status==='published'?'Alterar o status desta vaga? Novas candidaturas podem ser interrompidas.':undefined}><Hidden name="op" value="job-status"/><Hidden name="job_id" value={id}/><Select name="status" label="Status" value={job.status} required>{['draft','pending','published','paused','closed','cancelled','archived'].map(s=><option value={s} key={s}>{statusLabels[s]}</option>)}</Select></ActionForm> : <p>Seu acesso não permite alterar a publicação desta vaga.</p>}
  </aside></div></>;
}
