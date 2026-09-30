import Link from 'next/link';
import { db } from '@/lib/supabase';
import { isConfigured } from '@/lib/config';
import { Empty, Badge } from '@/ui/common';
import { Icon } from '@/ui/icon';
export async function JobsList({ limit = 12, q = '', model = '', page = 1 }: { limit?: number; q?: string; model?: string; page?: number }) {
  if (!isConfigured()) return <div className="setup-note"><Icon name="cloud_off" /><div><strong>Portal em configuração</strong><p>As oportunidades estarão disponíveis assim que o ambiente de recrutamento estiver conectado.</p></div></div>;
  const client = await db();
  let query = client.from('jobs').select('*',{count:'exact'}).eq('status','published').eq('visibility','public').order('published_at',{ascending:false}).range((page-1)*limit,page*limit-1);
  if (q) query = query.ilike('title',`%${q.replace(/[%_]/g,'')}%`);
  if (model) query = query.eq('work_model',model);
  const { data: jobs, error, count } = await query;
  if (error) return <div role="alert" className="alert danger">Não foi possível carregar as vagas. Tente atualizar a página.</div>;
  if (!jobs?.length) return <Empty title="Novas oportunidades estão por vir" description="Você pode deixar seu currículo no banco de talentos ou ajustar os filtros." href="/banco-de-talentos" action="Cadastrar currículo" icon="work_outline" />;
  return <><div className="jobs-grid">{jobs.map(job=><Link className="job-card" key={job.id} href={`/vagas/${job.slug}`}><div className="job-card-top"><span className="job-icon"><Icon name="work_outline" /></span><Badge>{job.work_model}</Badge></div><h3>{job.title}</h3><p><Icon name="location_on" />{job.city}{job.state ? `, ${job.state}`:''}</p><div className="job-card-bottom"><span>{job.contract_type} · {job.openings} {job.openings===1?'oportunidade':'oportunidades'}</span><Icon name="arrow_forward" /></div></Link>)}</div>{(count||0)>limit && <div className="pagination">{page>1 && <Link href={`/vagas?q=${encodeURIComponent(q)}&model=${encodeURIComponent(model)}&page=${page-1}`}>Anterior</Link>}<span>Página {page} · {count} oportunidades</span>{page*limit<(count||0) && <Link href={`/vagas?q=${encodeURIComponent(q)}&model=${encodeURIComponent(model)}&page=${page+1}`}>Próxima</Link>}</div>}</>;
}
