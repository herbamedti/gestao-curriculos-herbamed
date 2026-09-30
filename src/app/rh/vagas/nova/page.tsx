import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { JobEditor } from '@/modules/jobs/editor';
export default async function NewJob() {const {client}=await requirePermission('jobs.manage');const {data:departments}=await client.from('departments').select('id,name').eq('active',true).order('name');return <><PageHeading eyebrow="RECRUTAMENTO / VAGAS" title="Criar vaga" description="Comece pela descrição. Você poderá adicionar etapas e perguntas depois."/><JobEditor departments={departments||[]}/></>;}
