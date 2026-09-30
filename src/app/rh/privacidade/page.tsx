import Link from 'next/link';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Badge, Empty, date } from '@/ui/common';
import { ActionForm, Field, Hidden, Select, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';
export default async function PrivacyRequests() {
  const {client}=await requirePermission('privacy.manage');
  const [{data:requests},{data:policy}]=await Promise.all([
    client.from('privacy_requests').select('*').order('created_at',{ascending:false}).limit(100),
    client.from('privacy_policies').select('version,title,published_at').eq('active',true).maybeSingle(),
  ]);
  const ids=requests?.map(r=>r.candidate_id)||[];
  const people=ids.length?(await client.from('candidates').select('id,full_name').in('id',ids)).data:[];
  return <><PageHeading eyebrow="PRIVACIDADE E SEGURANÇA" title="Privacidade" description="Publique o aviso aprovado e trate as solicitações dos titulares."/>
    <section className="card"><h2>Aviso de privacidade</h2>
      <p className="muted">{policy?`Versão ativa: ${policy.version} — ${policy.title} (publicada em ${date(policy.published_at,true)}).`:'Nenhum aviso ativo. Candidaturas ficam bloqueadas até a publicação.'}</p>
      <p className="muted">Use apenas o texto aprovado pela Herbamed para este ambiente. Uma nova versão substitui a anterior para novas candidaturas e preserva o histórico de ciência.</p>
      <ActionForm action={mutate} submit="Publicar nova versão" confirm="Publicar este aviso de privacidade para as próximas candidaturas?">
        <Hidden name="op" value="privacy-policy"/>
        <div className="form-grid"><Field name="version" label="Versão" required maxLength={40} placeholder="Ex.: 2026-01"/><Field name="title" label="Título do aviso" required minLength={5} maxLength={160}/></div>
        <TextArea name="body" label="Texto integral aprovado" required rows={12}/>
        <label className="check"><input type="checkbox" name="approved" required/>Confirmo que este texto foi aprovado pela equipe responsável.</label>
      </ActionForm>
    </section>
    <section className="card"><h2>Solicitações dos titulares</h2>{requests?.length?requests.map(r=><article className="message" key={r.id}><div className="card-header"><div><strong>{people?.find(p=>p.id===r.candidate_id)?.full_name||'Titular'} · {r.kind}</strong><p className="muted">Protocolo {r.id} · {date(r.created_at,true)}</p></div><Badge>{r.status}</Badge></div><p>{r.detail}</p><Link className="text-link" href={`/rh/candidatos/${r.candidate_id}`}>Ver perfil</Link><ActionForm action={mutate} submit="Registrar decisão"><Hidden name="op" value="resolve-privacy"/><Hidden name="id" value={r.id}/><Select name="status" label="Situação" value={r.status}><option value="reviewing">Em análise</option><option value="completed">Concluída</option><option value="denied">Indeferida</option></Select><TextArea name="resolution" label="Fundamentação e providências" required/></ActionForm></article>):<Empty title="Nenhuma solicitação" description="Os pedidos de titulares aparecerão neste painel." icon="shield"/>}</section>
  </>;
}
