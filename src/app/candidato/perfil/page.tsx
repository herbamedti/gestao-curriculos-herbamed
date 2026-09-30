import Link from 'next/link';
import { session } from '@/modules/auth/session';
import { PageHeading, Empty, Badge, date } from '@/ui/common';
import { ActionForm, Field, Hidden, Select, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';
import { curriculumFields, curriculumMissing } from '@/modules/candidates/profile';

const entryKinds:Record<string,string>={experience:'Experiência profissional',education:'Formação acadêmica',course:'Curso',certification:'Certificação',language:'Idioma'};

export default async function Profile({searchParams}:{searchParams:Promise<{etapa?:string}>}) {
  const {client,user}=await session();
  const [{data:profile},{data:areas}]=await Promise.all([
    client.from('candidates').select('*').eq('user_id',user.id).maybeSingle(),
    client.from('interest_areas').select('id,name').eq('active',true).order('name'),
  ]);
  const interests=profile?(await client.from('candidate_interests').select('area_id').eq('candidate_id',profile.id)).data?.map(i=>i.area_id)||[]:[];
  const entries=profile?(await client.from('profile_entries').select('*').eq('candidate_id',profile.id).order('start_date',{ascending:false,nullsFirst:false})).data||[]:[];
  const missing=curriculumMissing(profile,entries);
  const tab=(await searchParams).etapa||'dados';
  const tabs=[['dados','Dados e habilidades'],['trajetoria','Experiência e formação'],['revisao','Revisar e exportar']];

  return <>
    <PageHeading eyebrow="MEU CURRÍCULO" title="Sua história profissional" description="Monte seu currículo aqui. Você pode salvar por etapas e exportar o resultado em PDF." />
    <nav className="tabs" aria-label="Etapas do currículo">{tabs.map(([key,label])=><Link key={key} href={`/candidato/perfil?etapa=${key}`} className={tab===key?'active':''} aria-current={tab===key?'page':undefined}>{label}</Link>)}</nav>

    {tab==='dados'&&<div className="card">
      <div className="card-header"><h2>Dados pessoais e profissionais</h2><Badge>Etapa 1 de 3</Badge></div>
      <p className="muted">Seu e-mail é o da conta de acesso. Informe um telefone com DDD, sua área de atuação, um resumo e suas principais habilidades.</p>
      <ActionForm action={mutate} submit="Salvar dados do currículo">
        <Hidden name="op" value="profile" />{profile&&<Hidden name="candidate_id" value={profile.id} />}
        <div className="form-grid">
          <Field name="full_name" label="Nome completo" value={profile?.full_name} required maxLength={160} autoComplete="name" />
          <Field name="phone" label="Telefone com DDD" value={profile?.phone} required maxLength={30} autoComplete="tel" placeholder="(47) 99999-9999" />
          <Field name="city" label="Cidade" value={profile?.city} required maxLength={100} />
          <Field name="state" label="UF" value={profile?.state} maxLength={2} />
          <Field name="headline" label="Cargo ou área de atuação" value={profile?.headline} required maxLength={160} placeholder="Ex.: Analista de Qualidade" />
          <Field name="professional_url" label="LinkedIn ou portfólio (HTTPS, opcional)" value={profile?.professional_url} type="url" />
          <div className="full"><TextArea name="summary" label="Resumo profissional (mínimo de 30 caracteres para candidatura)" value={profile?.summary||''} required rows={5} /></div>
          <div className="full"><Field name="skills" label="Habilidades (separe por vírgulas)" value={profile?.skills.join(', ')} required placeholder="Qualidade, Excel, atendimento..." /></div>
          <Select name="availability" label="Disponibilidade" value={profile?.availability}><option value="">Selecione</option><option>Imediata</option><option>Em até 30 dias</option><option>Em até 60 dias</option></Select>
          <Select name="work_model" label="Modelo preferido" value={profile?.work_model}><option value="">Selecione</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></Select>
        </div>
        <fieldset><legend>Áreas de interesse (até 3)</legend><div className="checkbox-grid">{areas?.map(a=><label className="check" key={a.id}><input type="checkbox" name="interests" value={a.id} defaultChecked={interests.includes(a.id)} />{a.name}</label>)}</div></fieldset>
      </ActionForm>
    </div>}

    {tab==='trajetoria'&&<div className="split">
      <div className="card"><h2>Sua trajetória</h2><p className="muted">Adicione experiências, formação acadêmica, cursos, certificações e idiomas. Para candidatar-se, basta uma experiência ou formação com nome e instituição.</p>
        {entries.length?entries.map(entry=><div className="message" key={entry.id}>
          <strong>{entryKinds[entry.kind]||entry.kind}: {entry.title}</strong>
          <p>{entry.organization}{entry.start_date?` · ${date(entry.start_date)}`:''}{entry.end_date?` – ${date(entry.end_date)}`:entry.start_date?' – atual':''}</p>
          {entry.description&&<p>{entry.description}</p>}
          <details><summary>Editar informação</summary><ActionForm action={mutate} submit="Salvar alteração">
            <Hidden name="op" value="edit-entry" /><Hidden name="candidate_id" value={profile!.id} /><Hidden name="entry_id" value={entry.id} />
            <Select name="kind" label="Tipo" value={entry.kind}>{Object.entries(entryKinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
            <Field name="title" label="Cargo, curso ou título" value={entry.title} required maxLength={160} />
            <Field name="organization" label="Empresa ou instituição" value={entry.organization} required maxLength={160} />
            <div className="form-grid"><Field name="start_date" label="Início" type="date" value={entry.start_date||''} /><Field name="end_date" label="Fim (vazio se atual)" type="date" value={entry.end_date||''} /></div>
            <TextArea name="description" label="Atividades, resultados ou detalhes" value={entry.description} />
          </ActionForm></details>
          <ActionForm action={mutate} submit="Remover" confirm="Remover esta informação do currículo?"><Hidden name="op" value="delete-entry" /><Hidden name="candidate_id" value={profile!.id} /><Hidden name="entry_id" value={entry.id} /></ActionForm>
        </div>):<Empty title="Sua trajetória começa aqui" description="Adicione uma experiência profissional ou formação para completar o currículo." icon="history_edu" />}
      </div>
      <div className="card"><h2>Adicionar informação</h2>{profile?<ActionForm action={mutate} submit="Adicionar ao currículo">
        <Hidden name="op" value="entry" /><Hidden name="candidate_id" value={profile.id} />
        <Select name="kind" label="Tipo" required>{Object.entries(entryKinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
        <Field name="title" label="Cargo, curso ou título" required maxLength={160} />
        <Field name="organization" label="Empresa ou instituição" required maxLength={160} />
        <div className="form-grid"><Field name="start_date" label="Início" type="date" /><Field name="end_date" label="Fim (vazio se atual)" type="date" /></div>
        <TextArea name="description" label="Atividades, resultados ou detalhes" />
      </ActionForm>:<p>Salve seus dados pessoais antes de adicionar sua trajetória.</p>}</div>
    </div>}

    {tab==='revisao'&&<div className="split">
      <div className="card"><h2>Revisão do currículo</h2>
        {profile?<><p><strong>{profile.full_name}</strong><br />{profile.headline||'Área de atuação pendente'} · {profile.city||'Cidade pendente'}{profile.state?` / ${profile.state}`:''}</p>
          <p>{profile.email} · {profile.phone||'Telefone pendente'}</p><p className="detail-body">{profile.summary||'Resumo profissional pendente.'}</p>
          <p><strong>Habilidades:</strong> {profile.skills.join(', ')||'Pendente'}</p>
          <h3>Trajetória</h3>{entries.length?entries.map(entry=><p key={entry.id}><strong>{entry.title}</strong> · {entry.organization}<br /><small>{entryKinds[entry.kind]||entry.kind}</small></p>):<p className="muted">Nenhuma informação adicionada.</p>}
          <a className="button outlined" href={`/api/curriculos/${profile.id}/pdf`}>Exportar currículo em PDF</a>
        </>:<p>Salve seus dados para visualizar o currículo.</p>}
      </div>
      <aside className="card"><h2>Antes de se candidatar</h2>{missing.length===0?<div className="alert success">Seu currículo contém os dados essenciais para uma candidatura.</div>:<><p className="muted">Complete os itens abaixo para poder enviar candidaturas:</p><ul>{curriculumFields.filter(field=>missing.includes(field.key)).map(field=><li key={field.key}><Link className="text-link" href={`/candidato/perfil?etapa=${field.step}`}>{field.label}</Link></li>)}</ul></>}
        <Link className="button tonal" href="/vagas">Explorar vagas</Link>
      </aside>
    </div>}
  </>;
}
