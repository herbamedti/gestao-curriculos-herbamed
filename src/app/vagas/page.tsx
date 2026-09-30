import { PublicShell } from '@/ui/public-shell';
import { PageHeading } from '@/ui/common';
import { JobsList } from '@/modules/jobs/list';
export default async function Jobs({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  const params = await searchParams;
  const page = Math.max(1,Math.min(1000,Number(params.page)||1));
  return <PublicShell><section className="container page-section"><PageHeading eyebrow="OPORTUNIDADES HERBAMED" title="O próximo passo é seu." description="Encontre uma oportunidade que combine com a sua trajetória." /><form className="search-bar" action="/vagas"><label className="field"><span>Busque uma vaga</span><input name="q" placeholder="Cargo ou palavra-chave" defaultValue={params.q} maxLength={100} /></label><label className="field"><span>Modelo de trabalho</span><select name="model" defaultValue={params.model}><option value="">Todos os modelos</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select></label><button className="button primary">Buscar vagas</button></form><JobsList q={params.q} model={params.model} page={page} /></section></PublicShell>;
}
