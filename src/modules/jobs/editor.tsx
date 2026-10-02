import { ActionForm, Field, Hidden, Select, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';
import type { Database } from '@/lib/database.types';
import { EditableList } from '@/ui/editable-list';
import { jobItems } from './items';
type Job=Database['public']['Tables']['jobs']['Row'];
type Option={id:string;name:string;active?:boolean};
export function JobEditor({job,departments,experienceLevels,employmentTypes}:{job?:Job|null;departments:Option[];experienceLevels:Option[];employmentTypes:Option[]}) {
  return <div className="card"><h2>{job?'Editar oportunidade':'Nova oportunidade'}</h2><ActionForm action={mutate} submit="Salvar vaga">
    <Hidden name="op" value="job"/>{job&&<Hidden name="job_id" value={job.id}/>}
    <div className="form-grid">
      <Field name="title" label="Título da vaga" value={job?.title} required maxLength={160}/>
      <Select name="department_id" label="Departamento" value={job?.department_id||''}><option value="">Não definido</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Select>
      <Field name="city" label="Cidade" value={job?.city} required maxLength={100}/><Field name="state" label="UF" value={job?.state} maxLength={2}/>
      <Select name="work_model" label="Modelo de trabalho" value={job?.work_model||'Presencial'} required><option>Presencial</option><option>Híbrido</option><option>Remoto</option></Select>
      <Field name="contract_type" label="Contrato" value={job?.contract_type||'CLT'} required maxLength={50}/>
      <Select name="experience_level_id" label="Nível de experiência" value={job?.experience_level_id||''}><option value="">Não definido</option>{experienceLevels.filter(item=>item.active!==false||item.id===job?.experience_level_id).map(item=><option key={item.id} value={item.id}>{item.name}{item.active===false?' (inativo)':''}</option>)}</Select>
      <Select name="employment_type_id" label="Tipo de emprego" value={job?.employment_type_id||''}><option value="">Não definido</option>{employmentTypes.filter(item=>item.active!==false||item.id===job?.employment_type_id).map(item=><option key={item.id} value={item.id}>{item.name}{item.active===false?' (inativo)':''}</option>)}</Select>
      <Field name="openings" label="Quantidade de vagas" type="number" value={job?.openings||1} min={1} max={1000}/><Field name="deadline" label="Prazo final" type="date" value={job?.deadline?.slice(0,10)||''}/>
      <div className="full"><TextArea name="description" label="Descrição" value={job?.description} required rows={7}/></div>
      {(['responsibilities','requirements','benefits'] as const).map((name,index)=><div className="full" key={name}><EditableList name={name} label={['Responsabilidades','Requisitos','Benefícios'][index]} initial={jobItems(job?.[name]||'')} maxItems={30} maxLength={10000}/></div>)}
    </div>
  </ActionForm></div>;
}
