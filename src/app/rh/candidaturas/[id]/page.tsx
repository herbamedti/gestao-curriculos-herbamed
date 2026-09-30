import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Badge, date } from '@/ui/common';
import { ActionForm, Field, Hidden, Select, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';

export default async function ApplicationDetail({params}:{params:Promise<{id:string}>}) {
  const id=(await params).id;
  const {client}=await requirePermission('applications.read');
  const {data:app}=await client.from('applications').select('*').eq('id',id).maybeSingle();
  if(!app)notFound();
  const [person,job,stages,events,evaluations,interviews,answers,questions,entries]=await Promise.all([
    client.from('candidates').select('*').eq('id',app.candidate_id).maybeSingle(),
    client.from('jobs').select('title').eq('id',app.job_id).maybeSingle(),
    client.from('job_stages').select('*').eq('job_id',app.job_id).order('position'),
    client.from('application_events').select('*').eq('application_id',id).order('created_at',{ascending:false}),
    client.from('evaluations').select('*').eq('application_id',id).order('created_at',{ascending:false}),
    client.from('interviews').select('*').eq('application_id',id).order('starts_at',{ascending:false}),
    client.from('application_answers').select('*').eq('application_id',id),
    client.from('job_questions').select('*').eq('job_id',app.job_id),
    client.from('profile_entries').select('id,kind,title,organization,description').eq('candidate_id',app.candidate_id),
  ]);
  return <>
    <PageHeading eyebrow="RECRUTAMENTO / CANDIDATURA" title={person.data?.full_name||'Candidatura'} description={`${job.data?.title||'Vaga'} · enviada em ${date(app.created_at)}`}>
      <Badge>{stages.data?.find(s=>s.id===app.stage_id)?.name||app.status}</Badge>
      <Link className="button outlined" href={`/rh/candidatos/${app.candidate_id}`}>Ver perfil completo</Link>
    </PageHeading>
    <div className="split"><div>
      <div className="card"><h2>Currículo da pessoa candidata</h2>
        <p><strong>Local:</strong> {person.data?.city||'Não informado'}{person.data?.state?`, ${person.data.state}`:''}</p>
        <p><strong>Atuação:</strong> {person.data?.headline||'Não informada'}</p>
        <p className="detail-body">{person.data?.summary||'Sem resumo.'}</p>
        <p><strong>Habilidades:</strong> {person.data?.skills.join(', ')||'Não informadas'}</p>
        {entries.data?.map(entry=><div className="message" key={entry.id}><strong>{entry.title}</strong><p>{entry.organization} · {entry.kind}</p>{entry.description&&<p>{entry.description}</p>}</div>)}
        <a className="button outlined" href={`/api/curriculos/${app.candidate_id}/pdf`}>Exportar currículo em PDF</a>
      </div>
      <div className="card"><h2>Respostas</h2>{answers.data?.length?answers.data.map(answer=><div key={answer.question_id} className="message"><strong>{questions.data?.find(q=>q.id===answer.question_id)?.label}</strong><p>{answer.answer||'Sem resposta'}</p></div>):<p className="muted">Sem perguntas adicionais.</p>}</div>
      <div className="card"><h2>Histórico</h2><ul className="timeline">{events.data?.map(event=><li key={event.id}><strong>{event.to_stage?stages.data?.find(s=>s.id===event.to_stage)?.name:'Registro'}</strong><p>{event.note}</p><small>{date(event.created_at,true)}</small></li>)}</ul></div>
      <div className="card"><h2>Avaliações e observações</h2>{evaluations.data?.map(evaluation=><div className="message" key={evaluation.id}><strong>{evaluation.kind==='note'?'Observação':'Avaliação'} · {date(evaluation.created_at,true)}</strong><p>{evaluation.body}</p>{evaluation.criteria&&<small>Critério: {evaluation.criteria}</small>}</div>)}
        <ActionForm action={mutate} submit="Registrar"><Hidden name="op" value="evaluation" /><Hidden name="application_id" value={id} /><Select name="kind" label="Tipo"><option value="note">Observação</option><option value="evaluation">Avaliação</option></Select><Field name="criteria" label="Critério (opcional)" /><TextArea name="body" label="Registro" required /><Field name="recommendation" label="Recomendação (opcional)" /></ActionForm>
      </div>
    </div><aside>
      <div className="card"><h2>Mover etapa</h2><ActionForm action={mutate} submit="Registrar movimentação" confirm="Mover esta candidatura? A pessoa receberá uma atualização."><Hidden name="op" value="move" /><Hidden name="application_id" value={id} /><Hidden name="expected_stage" value={app.stage_id} /><Select name="stage_id" label="Nova etapa" required><option value="">Selecione</option>{stages.data?.filter(s=>s.id!==app.stage_id).map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</Select><Field name="note" label="Justificativa (opcional)" /></ActionForm></div>
      <div className="card"><h2>Entrevistas</h2>{interviews.data?.map(interview=><div className="message" key={interview.id}><strong>{date(interview.starts_at,true)}</strong><p>{interview.location}</p></div>)}<ActionForm action={mutate} submit="Agendar"><Hidden name="op" value="interview" /><Hidden name="application_id" value={id} /><Field name="starts_at" label="Data e hora" type="datetime-local" required /><Field name="location" label="Local ou link" required /><Field name="duration" label="Duração (minutos)" type="number" value={30} min={10} max={480} /></ActionForm></div>
      <div className="card"><h2>Enviar mensagem</h2><ActionForm action={mutate} submit="Enviar"><Hidden name="op" value="message" /><Hidden name="candidate_id" value={app.candidate_id} /><Field name="subject" label="Assunto" required /><TextArea name="body" label="Mensagem" required /></ActionForm></div>
    </aside></div>
  </>;
}
