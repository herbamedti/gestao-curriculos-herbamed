import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/modules/auth/session';
import { curriculumFields, curriculumMissing } from '@/modules/candidates/profile';
import { StaffCurriculumForm } from '@/modules/candidates/staff-curriculum-form';
import { PageHeading, Badge, date } from '@/ui/common';
import { ActionForm, Hidden, Field, Select, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';

const labels:Record<string,string>={experience:'Experiência profissional',education:'Formação acadêmica',course:'Curso',certification:'Certificação',language:'Idioma'};

export default async function CandidateDetail({params}:{params:Promise<{id:string}>}) {
  const id=(await params).id;
  const {client}=await requirePermission('candidates.read');
  const [personResult,entriesResult,documentsResult,applicationsResult,messagesResult,areasResult,interestsResult,editPermission,linkPermission,openJobsResult]=await Promise.all([
    client.from('candidates').select('*').eq('id',id).maybeSingle(),
    client.from('profile_entries').select('*').eq('candidate_id',id).order('start_date',{ascending:false,nullsFirst:false}),
    client.from('documents').select('id,original_name,status,created_at').eq('candidate_id',id).order('created_at',{ascending:false}),
    client.from('applications').select('id,job_id,status,created_at').eq('candidate_id',id).order('created_at',{ascending:false}),
    client.from('messages').select('*').eq('candidate_id',id).order('created_at',{ascending:false}),
    client.from('interest_areas').select('id,name').eq('active',true).order('name'),
    client.from('candidate_interests').select('area_id').eq('candidate_id',id),
    client.rpc('has_permission',{p_permission:'candidates.edit'}),
    client.rpc('has_permission',{p_permission:'applications.link'}),
    client.from('jobs').select('id,title,deadline').eq('status','published').eq('visibility','public').order('title'),
  ]);
  const person=personResult.data;
  if(!person)notFound();
  const entries=entriesResult.data||[];
  const applications=applicationsResult.data||[];
  const jobIds=applications.map(application=>application.job_id);
  const jobs=jobIds.length?(await client.from('jobs').select('id,title').in('id',jobIds)).data||[]:[];
  const missing=curriculumMissing(person,entries);
  const canEdit=editPermission.data===true;
  const canLink=linkPermission.data===true;
  const availableJobs=(openJobsResult.data||[]).filter(job=>!jobIds.includes(job.id)&&(!job.deadline||new Date(job.deadline)>new Date()));

  return <>
    <PageHeading eyebrow="TALENTOS / PERFIL" title={person.full_name} description={`${person.headline||'Área não informada'} · ${person.city||'Local não informado'}`}>
      <a className="button outlined" href={`/api/curriculos/${person.id}/pdf`}>Exportar currículo em PDF</a>
      <Badge tone={person.talent_pool?'green':''}>{person.talent_pool?'Banco de talentos':'Candidaturas'}</Badge>
    </PageHeading>
    <div className="split"><div>
      <div className="card"><h2>Currículo na plataforma</h2><p className="detail-body">{person.summary||'Sem resumo profissional.'}</p><p><strong>Habilidades:</strong> {person.skills.join(', ')||'Não informadas'}</p><p className="muted">Atualizado em {date(person.updated_at,true)}</p></div>
      {canEdit&&<div className="card"><h2>Editar dados do currículo</h2><p className="muted">As alterações ficam visíveis também para a pessoa candidata que cadastrou o próprio perfil.</p><StaffCurriculumForm candidate={person} areas={areasResult.data||[]} interests={interestsResult.data?.map(item=>item.area_id)||[]} /></div>}
      <div className="card"><h2>Experiência e formação</h2>{entries.length?entries.map(entry=><div className="message" key={entry.id}>
        <strong>{labels[entry.kind]||entry.kind}: {entry.title}</strong><p>{entry.organization}{entry.start_date?` · ${date(entry.start_date)}`:''}{entry.end_date?` – ${date(entry.end_date)}`:''}</p>{entry.description&&<p>{entry.description}</p>}
        {canEdit&&<><details><summary>Editar informação</summary><ActionForm action={mutate} submit="Salvar alteração">
          <Hidden name="op" value="edit-entry" /><Hidden name="candidate_id" value={id} /><Hidden name="entry_id" value={entry.id} />
          <Select name="kind" label="Tipo" value={entry.kind}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
          <Field name="title" label="Cargo, curso ou título" value={entry.title} required maxLength={160} />
          <Field name="organization" label="Empresa ou instituição" value={entry.organization} required maxLength={160} />
          <div className="form-grid"><Field name="start_date" label="Início" type="date" value={entry.start_date||''} /><Field name="end_date" label="Fim (vazio se atual)" type="date" value={entry.end_date||''} /></div>
          <TextArea name="description" label="Atividades, resultados ou detalhes" value={entry.description} />
        </ActionForm></details>
        <ActionForm action={mutate} submit="Remover informação" confirm="Remover esta informação do currículo?"><Hidden name="op" value="delete-entry" /><Hidden name="candidate_id" value={id} /><Hidden name="entry_id" value={entry.id} /></ActionForm></>}
      </div>):<p className="muted">Nenhuma informação registrada.</p>}
        {canEdit&&<><h3>Adicionar informação</h3><ActionForm action={mutate} submit="Adicionar ao currículo">
          <Hidden name="op" value="entry" /><Hidden name="candidate_id" value={id} />
          <Select name="kind" label="Tipo" required>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
          <Field name="title" label="Cargo, curso ou título" required maxLength={160} />
          <Field name="organization" label="Empresa ou instituição" required maxLength={160} />
          <div className="form-grid"><Field name="start_date" label="Início" type="date" /><Field name="end_date" label="Fim (vazio se atual)" type="date" /></div>
          <TextArea name="description" label="Atividades, resultados ou detalhes" />
        </ActionForm></>}
      </div>
      <div className="card"><h2>Vagas vinculadas</h2>{applications.length?applications.map(application=><div className="file-row" key={application.id}><div><strong>{jobs.find(job=>job.id===application.job_id)?.title||'Vaga'}</strong><small>{date(application.created_at)}</small></div><Link className="text-link" href={`/rh/candidaturas/${application.id}`}>Ver processo</Link></div>):<p className="muted">Nenhuma vaga vinculada.</p>}</div>
      <div className="card"><h2>Mensagens</h2>{messagesResult.data?.map(message=><div className="message" key={message.id}><strong>{message.subject}</strong><p>{message.body}</p><small>{date(message.created_at,true)}</small></div>)}</div>
    </div><aside>
      <div className="card"><h2>Currículo para candidatura</h2>{missing.length?<><p className="muted">Complete estes itens antes de vincular a uma vaga:</p><ul>{curriculumFields.filter(field=>missing.includes(field.key)).map(field=><li key={field.key}>{field.label}</li>)}</ul></>:<div className="alert success">Dados essenciais completos.</div>}</div>
      {canLink&&<div className="card"><h2>Vincular a uma vaga</h2><p className="muted">Selecione uma vaga publicada. O vínculo cria uma candidatura e registra o motivo da inclusão.</p>{missing.length?<p>Complete o currículo antes de continuar.</p>:availableJobs.length?<ActionForm action={mutate} submit="Vincular candidato" confirm="Vincular esta pessoa à vaga selecionada?">
        <Hidden name="op" value="link-candidate" /><Hidden name="candidate_id" value={id} />
        <Select name="job_id" label="Vaga" required><option value="">Selecione</option>{availableJobs.map(job=><option key={job.id} value={job.id}>{job.title}</option>)}</Select>
        <TextArea name="note" label="Motivo da vinculação" required rows={3} />
      </ActionForm>:<p>Nenhuma vaga publicada disponível para novo vínculo.</p>}</div>}
      <div className="card"><h2>Contato</h2><p>{person.email}</p><p>{person.phone||'Telefone não informado'}</p><p>{person.city}, {person.state}</p>{person.professional_url&&<a className="text-link" href={person.professional_url} target="_blank" rel="noopener noreferrer">Perfil profissional ↗</a>}</div>
      {!!documentsResult.data?.length&&<details className="card"><summary>Arquivos anteriores ({documentsResult.data.length})</summary><p className="muted">Fluxo de upload desativado. Os registros anteriores foram preservados.</p>{documentsResult.data.map(document=><div className="file-row" key={document.id}><strong>{document.original_name}</strong><small>{date(document.created_at)}</small></div>)}</details>}
      <div className="card"><h2>Entrar em contato</h2><ActionForm action={mutate} submit="Enviar mensagem"><Hidden name="op" value="message" /><Hidden name="candidate_id" value={id} /><Field name="subject" label="Assunto" required /><TextArea name="body" label="Mensagem" required /></ActionForm></div>
    </aside></div>
  </>;
}
