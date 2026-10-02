import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { JobEditor } from '@/modules/jobs/editor';
export default async function NewJob() {
  const {client}=await requirePermission('jobs.manage');
  const [departments,levels,types]=await Promise.all([
    client.from('departments').select('id,name').eq('active',true).order('name'),
    client.from('experience_levels').select('id,name,active').order('name'),
    client.from('employment_types').select('id,name,active').order('name'),
  ]);
  return <><PageHeading eyebrow="RECRUTAMENTO / VAGAS" title="Criar vaga" description="Descreva a oportunidade e adicione responsabilidades, requisitos e benefícios. Você poderá adicionar etapas e perguntas depois."/><JobEditor departments={departments.data||[]} experienceLevels={levels.data||[]} employmentTypes={types.data||[]}/></>;
}
