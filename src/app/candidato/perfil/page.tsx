import Link from 'next/link';
import { session } from '@/modules/auth/session';
import { PageHeading, Badge } from '@/ui/common';
import { ActionForm, Field, Hidden, Select, TextArea } from '@/ui/form';
import { CurriculumFields, InterestFields, CurriculumExtraSummary } from '@/modules/candidates/curriculum-fields';
import { CurriculumEntryCards } from '@/modules/candidates/entry-cards';
import { TrajectoryCards } from '@/modules/candidates/trajectory-cards';
import { entryKindLabel, entryDetails } from '@/modules/candidates/details';
import { mutate } from '@/modules/actions';
import { curriculumFields, curriculumMissing } from '@/modules/candidates/profile';

export default async function Profile({searchParams}:{searchParams:Promise<{etapa?:string}>}) {
  const {client,user}=await session();
  const [{data:profile},{data:areas,error:areasError}]=await Promise.all([
    client.from('candidates').select('*').eq('user_id',user.id).maybeSingle(),
    client.from('interest_areas').select('id,name').eq('active',true).order('name'),
  ]);
  const [interestResult,entryResult]=profile?await Promise.all([
    client.from('candidate_interests').select('area_id').eq('candidate_id',profile.id),
    client.from('profile_entries').select('*').eq('candidate_id',profile.id).order('start_date',{ascending:false,nullsFirst:false}),
  ]):[{data:[]},{data:[]}];
  const interests=interestResult.data?.map(item=>item.area_id)||[];
  const entries=entryResult.data||[];
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
          <CurriculumFields candidate={profile} />
          <div className="full"><TextArea name="summary" label="Resumo profissional (mínimo de 30 caracteres para candidatura)" value={profile?.summary||''} required rows={5} /></div>
          <Select name="availability" label="Disponibilidade" value={profile?.availability}><option value="">Selecione</option><option>Imediata</option><option>Em até 30 dias</option><option>Em até 60 dias</option></Select>
          <Select name="work_model" label="Modelo preferido" value={profile?.work_model}><option value="">Selecione</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></Select>
        </div>
        <InterestFields areas={areas||[]} interests={interests} error={!!areasError} />
        {!profile && <CurriculumEntryCards />}
      </ActionForm>
    </div>}

    {tab==='trajetoria'&&<div className="card"><h2>Sua trajetória</h2><p className="muted">Adicione experiências, histórico acadêmico, cursos, certificados e idiomas em seus respectivos cards. Para candidatar-se, basta uma experiência ou formação com nome e instituição.</p>{profile?<TrajectoryCards candidateId={profile.id} entries={entries} />:<p>Comece pelo cadastro em Dados e habilidades; os mesmos cards estão disponíveis lá para salvar junto do currículo inicial.</p>}</div>}

    {tab==='revisao'&&<div className="split">
      <div className="card"><h2>Revisão do currículo</h2>
        {profile?<><p><strong>{profile.full_name}</strong><br />{profile.headline||'Área de atuação pendente'} · {profile.city||'Cidade pendente'}{profile.state?` / ${profile.state}`:''}</p>
          <p>{profile.email} · {profile.phone||'Telefone pendente'}</p><p className="detail-body">{profile.summary||'Resumo profissional pendente.'}</p>
          <CurriculumExtraSummary candidate={profile} />
          <p><strong>Habilidades:</strong> {profile.skills.join(', ')||'Pendente'}</p>
          <h3>Trajetória</h3>{entries.length?entries.map(entry=><p key={entry.id}><strong>{entry.title}</strong> · {entry.organization}<br /><small>{entryKindLabel(entry.kind)}{entryDetails(entry)?` · ${entryDetails(entry)}`:''}</small></p>):<p className="muted">Nenhuma informação adicionada.</p>}
          <a className="button outlined" href={`/api/curriculos/${profile.id}/pdf`}>Exportar currículo em PDF</a>
        </>:<p>Salve seus dados para visualizar o currículo.</p>}
      </div>
      <aside className="card"><h2>Antes de se candidatar</h2>{missing.length===0?<div className="alert success">Seu currículo contém os dados essenciais para uma candidatura.</div>:<><p className="muted">Complete os itens abaixo para poder enviar candidaturas:</p><ul>{curriculumFields.filter(field=>missing.includes(field.key)).map(field=><li key={field.key}><Link className="text-link" href={`/candidato/perfil?etapa=${field.step}`}>{field.label}</Link></li>)}</ul></>}
        <Link className="button tonal" href="/vagas">Explorar vagas</Link>
      </aside>
    </div>}
  </>;
}
