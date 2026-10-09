import { StaffPermission } from '@/modules/auth/permission-gate';
import { DownloadButton } from '@/ui/download-button';
import Form from 'next/form';
import { SubmitButton } from '@/ui/submit-button';
import Link from '@/ui/link';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Empty, date } from '@/ui/common';
export default async function Candidates({searchParams}:{searchParams:Promise<{q?:string;city?:string;area?:string;page?:string;pool?:string}>}) {
  const {client}=await requirePermission('candidates.read');const p=await searchParams;const page=Math.max(1,Math.min(1000,Number(p.page)||1));
  if(p.pool==='1')await requirePermission('talents.read');
  const canCreate=(await client.rpc('has_permission',{p_permission:'candidates.create'})).data===true;
  const areas=(await client.from('interest_areas').select('id,name').eq('active',true).order('name')).data||[];
  let ids:string[]|undefined;
  if(p.area){const matches=await client.from('candidate_interests').select('candidate_id').eq('area_id',p.area).limit(5000);ids=matches.data?.map(x=>x.candidate_id)||[];}
  let query=client.from('candidates').select('id,full_name,city,state,headline,source,talent_pool,updated_at',{count:'exact'}).is('archived_at',null).order('updated_at',{ascending:false}).range((page-1)*20,page*20-1);
  if(p.q)query=query.or(`full_name.ilike.%${p.q.replace(/[(),.%_]/g,'').slice(0,80)}%,headline.ilike.%${p.q.replace(/[(),.%_]/g,'').slice(0,80)}%`);
  if(p.city)query=query.ilike('city',`%${p.city.replace(/[%_]/g,'').slice(0,100)}%`);
  if(p.pool==='1')query=query.eq('talent_pool',true);
  if(ids)query=query.in('id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
  const {data,count,error}=await query;
  const poolNote=p.pool==='1'?<div className="alert info talent-pool-note">Aqui aparecem os currículos com participação autorizada pelo candidato em Revisar e exportar ou Privacidade. O cadastro da conta e o preenchimento do currículo não ativam essa escolha. <Link className="text-link" href="/rh/candidatos">Ver todos os candidatos</Link></div>:null;
  return <><PageHeading eyebrow="TALENTOS" title={p.pool==='1'?'Banco de talentos':'Candidatos'} description="Encontre perfis por nome, atuação, cidade e área de interesse.">{canCreate&&<Link className="button primary" href="/rh/candidatos/novo">Cadastrar currículo +</Link>}<StaffPermission permission="candidates.export"><DownloadButton href="/api/rh/export-candidates" type="text/csv" filename="candidatos.csv">Exportar CSV</DownloadButton></StaffPermission></PageHeading>{poolNote}<Form className="search-bar" action="/rh/candidatos"><input type="hidden" name="pool" value={p.pool||''}/><label className="field"><span>Nome ou atuação</span><input name="q" defaultValue={p.q} placeholder="Buscar talento"/></label><label className="field"><span>Cidade</span><input name="city" defaultValue={p.city} placeholder="Cidade"/></label><label className="field"><span>Área</span><select name="area" defaultValue={p.area}><option value="">Todas as áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><SubmitButton className="button primary" pendingLabel="Buscando…">Filtrar</SubmitButton></Form><div className="card">{error?<p role="alert">Não foi possível carregar os candidatos.</p>:data?.length?<div className="table-wrap"><table><thead><tr><th>Candidato</th><th>Localização</th><th>Origem</th><th>Atualizado em</th><th></th></tr></thead><tbody>{data.map(c=><tr key={c.id}><td><strong>{c.full_name}</strong><small>{c.headline||'Área não informada'}</small></td><td>{c.city}{c.state?`, ${c.state}`:''}</td><td>{c.source}</td><td>{date(c.updated_at)}</td><td><Link className="text-link" href={`/rh/candidatos/${c.id}`}>Ver perfil</Link></td></tr>)}</tbody></table></div>:<Empty title="Nenhum candidato encontrado" description="Ajuste os filtros ou cadastre um candidato." icon="person_search"/>}</div><div className="pagination">{page>1&&<Link href={`?q=${encodeURIComponent(p.q||'')}&city=${encodeURIComponent(p.city||'')}&area=${p.area||''}&pool=${p.pool||''}&page=${page-1}`}>Anterior</Link>}<span>{count||0} pessoas · Página {page}</span>{page*20<(count||0)&&<Link href={`?q=${encodeURIComponent(p.q||'')}&city=${encodeURIComponent(p.city||'')}&area=${p.area||''}&pool=${p.pool||''}&page=${page+1}`}>Próxima</Link>}</div></>;
}
