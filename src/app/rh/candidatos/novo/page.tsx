import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { StaffCurriculumForm } from '@/modules/candidates/staff-curriculum-form';

export default async function ManualCandidate() {
  const {client}=await requirePermission('candidates.create');
  const {data:areas,error}=await client.from('interest_areas').select('id,name').eq('active',true).order('name');
  return <>
    <PageHeading eyebrow="TALENTOS / CANDIDATOS" title="Cadastrar currículo" description="Registre os dados profissionais, a origem e a base de tratamento. Depois, adicione experiências e formação no perfil criado." />
    <div className="card"><StaffCurriculumForm areas={areas||[]} areasError={!!error} /></div>
  </>;
}
