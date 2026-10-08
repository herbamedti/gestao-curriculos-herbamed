import type { Metadata } from 'next';
import { cache } from 'react';
import { JobBulletList } from '@/modules/jobs/bullet-list';
import Link from '@/ui/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { config, isConfigured } from '@/lib/config';
import { PublicShell } from '@/ui/public-shell';
import { Badge, date } from '@/ui/common';
import { Icon } from '@/ui/icon';
const jobBySlug=cache(async (slug:string) => {
  if(!isConfigured())return null;
  const client=await db();
  const {data}=await client.from('jobs').select('*,experience_levels(name),employment_types(name)').eq('slug',slug).eq('status','published').eq('visibility','public').maybeSingle();
  return data;
});
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata> {
  const job=await jobBySlug((await params).slug);
  if(!job)return {title:'Vaga indisponível',robots:{index:false}};
  const title=`${job.title} — ${job.city}`;
  const url=`${config.url}/vagas/${job.slug}`;
  return {title,description:job.description.slice(0,155),alternates:{canonical:url},openGraph:{title,description:job.description.slice(0,155),url,type:'website'}};
}
export default async function JobDetail({params}:{params:Promise<{slug:string}>}) {
  const job=await jobBySlug((await params).slug);
  if(!job)notFound();
  const structured={ '@context':'https://schema.org','@type':'JobPosting',title:job.title,description:job.description,datePosted:job.published_at,validThrough:job.deadline,employmentType:job.contract_type,hiringOrganization:{'@type':'Organization',name:'Herbamed'},jobLocation:job.work_model==='Remoto'?undefined:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:job.city,addressRegion:job.state,addressCountry:'BR'}},applicantLocationRequirements:job.work_model==='Remoto'?{'@type':'Country',name:'Brazil'}:undefined,jobLocationType:job.work_model==='Remoto'?'TELECOMMUTE':undefined,identifier:{'@type':'PropertyValue',name:'Herbamed',value:String(job.code)}};
  return <PublicShell><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/><div className="container page-section"><Link href="/vagas" className="text-link"><Icon name="arrow_back"/>Todas as vagas</Link><div style={{marginTop:30}} className="page-heading"><div><p className="eyebrow">OPORTUNIDADE HERBAMED · {job.code}</p><h1>{job.title}</h1><p className="muted">{job.city}{job.state?`, ${job.state}`:''} · {job.work_model} · {job.contract_type}</p></div><Link href={`/vagas/${job.slug}/candidatar`} className="button primary">Quero me candidatar <Icon name="arrow_forward"/></Link></div><div className="split"><article className="card detail-body"><Badge tone="green">Vaga aberta</Badge><h2>Sobre a oportunidade</h2><p>{job.description}</p>{job.responsibilities&&<><h2>Responsabilidades</h2><JobBulletList value={job.responsibilities}/></>}{job.requirements&&<><h2>Requisitos</h2><JobBulletList value={job.requirements}/></>}{job.benefits&&<><h2>Benefícios</h2><JobBulletList value={job.benefits}/></>}</article><aside className="card detail-summary"><h2>Em resumo</h2><dl><div><dt>Localidade</dt><dd>{job.city}{job.state?`, ${job.state}`:''}</dd></div><div><dt>Modelo de trabalho</dt><dd>{job.work_model}</dd></div><div><dt>Contrato</dt><dd>{job.contract_type}</dd></div>{job.experience_levels&&<div><dt>Nível de experiência</dt><dd>{job.experience_levels.name}</dd></div>}{job.employment_types&&<div><dt>Tipo de emprego</dt><dd>{job.employment_types.name}</dd></div>}<div><dt>Oportunidades</dt><dd>{job.openings}</dd></div>{job.deadline&&<div><dt>Prazo</dt><dd>{date(job.deadline)}</dd></div>}</dl><Link href={`/vagas/${job.slug}/candidatar`} className="button primary" style={{width:'100%'}}>Candidatar-se</Link><p className="muted" style={{fontSize:11,marginTop:15}}>Seus dados são tratados conforme nosso <Link className="text-link" href="/privacidade">aviso de privacidade</Link>.</p></aside></div></div></PublicShell>;
}
