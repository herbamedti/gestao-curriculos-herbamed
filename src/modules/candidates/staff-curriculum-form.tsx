import { ActionForm, Field, Hidden, Select, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';
import type { Database } from '@/lib/database.types';

type Candidate=Database['public']['Tables']['candidates']['Row'];
type Area={id:string;name:string};

export function StaffCurriculumForm({candidate,areas,interests=[]}:{candidate?:Candidate;areas:Area[];interests?:string[]}) {
  const manual=!candidate?.user_id;
  return <ActionForm action={mutate} submit={candidate?'Salvar currículo':'Cadastrar e continuar para experiência e formação'}>
    <Hidden name="op" value={candidate?'staff-curriculum':'manual-candidate'} />
    {candidate&&<Hidden name="candidate_id" value={candidate.id} />}
    <div className="form-grid">
      <Field name="full_name" label="Nome completo" value={candidate?.full_name} required maxLength={160} />
      <Field name="email" label="E-mail" type="email" value={candidate?.email} required maxLength={255} readOnly={!manual} />
      <Field name="phone" label="Telefone com DDD" value={candidate?.phone} maxLength={30} placeholder="(47) 99999-9999" />
      <Field name="city" label="Cidade" value={candidate?.city} maxLength={100} />
      <Field name="state" label="UF" value={candidate?.state} maxLength={2} />
      <Field name="headline" label="Cargo ou área de atuação" value={candidate?.headline} maxLength={160} />
      <Field name="professional_url" label="LinkedIn ou portfólio (HTTPS)" value={candidate?.professional_url} type="url" />
      <Field name="skills" label="Habilidades (separe por vírgulas)" value={candidate?.skills.join(', ')} placeholder="Qualidade, Excel, atendimento..." />
      <Select name="availability" label="Disponibilidade" value={candidate?.availability}><option value="">Selecione</option><option>Imediata</option><option>Em até 30 dias</option><option>Em até 60 dias</option></Select>
      <Select name="work_model" label="Modelo preferido" value={candidate?.work_model}><option value="">Selecione</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></Select>
      <div className="full"><TextArea name="summary" label="Resumo profissional" value={candidate?.summary||''} rows={5} /></div>
    </div>
    <fieldset><legend>Áreas de interesse</legend><div className="checkbox-grid">{areas.map(area=><label className="check" key={area.id}><input type="checkbox" name="interests" value={area.id} defaultChecked={interests.includes(area.id)} />{area.name}</label>)}</div></fieldset>
    {manual?<><h3>Origem e finalidade do cadastro</h3><div className="form-grid">
      <Field name="source" label="Origem (indicação, evento, cadastro manual…)" value={candidate?.source} required maxLength={100} />
      <Field name="processing_purpose" label="Finalidade do tratamento" value={candidate?.processing_purpose||'Recrutamento e seleção'} required maxLength={200} />
      <div className="full"><TextArea name="legal_basis" label="Base legal avaliada pela Herbamed" value={candidate?.legal_basis||''} required /></div>
    </div></>:<><Hidden name="source" value={candidate.source} /><Hidden name="processing_purpose" value={candidate.processing_purpose} /><Hidden name="legal_basis" value={candidate.legal_basis||''} /><p className="muted">O e-mail de acesso da pessoa candidata é mantido; alterações nessa identidade exigem o fluxo de conta.</p></>}
  </ActionForm>;
}
