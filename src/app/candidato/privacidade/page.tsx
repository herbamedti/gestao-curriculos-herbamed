import { DownloadButton } from '@/ui/download-button';
import { session } from '@/modules/auth/session';
import { PageHeading, Empty, date, Badge } from '@/ui/common';
import { ActionForm, Hidden, Select, TextArea } from '@/ui/form';
import { TalentPreference } from '@/modules/candidates/talent-preference';
import { mutate } from '@/modules/actions';
export default async function MyPrivacy() {
  const {client,user}=await session();
  const {data:profile}=await client.from('candidates').select('id,talent_pool').eq('user_id',user.id).maybeSingle();
  const {data:requests}=profile?await client.from('privacy_requests').select('*').eq('candidate_id',profile.id).order('created_at',{ascending:false}):{data:[]};
  return <><PageHeading eyebrow="SEUS DADOS" title="Central de privacidade" description="Transparência e controle sobre seus dados pessoais."/>
    <div className="split"><div><div className="card"><TalentPreference profile={profile}/></div>
      <div className="card"><h2>Minhas solicitações</h2>{requests?.length?requests.map(r=><div className="file-row" key={r.id}><div><strong>{r.kind}</strong><br/><small>Protocolo {r.id} · {date(r.created_at)}</small></div><Badge>{r.status}</Badge></div>):<Empty title="Sem solicitações" description="Quando fizer uma solicitação, acompanhe aqui a análise e a resposta." icon="shield"/>}</div>
    </div><div><div className="card"><h2>Solicitar análise</h2>{profile?<ActionForm action={mutate} submit="Enviar solicitação"><Hidden name="op" value="privacy-request"/><Select name="kind" label="Tipo de solicitação" required><option value="access">Acesso aos dados</option><option value="correction">Correção</option><option value="deletion">Exclusão</option><option value="portability">Portabilidade</option><option value="revocation">Revogar participação</option><option value="information">Informações sobre tratamento</option></Select><TextArea name="detail" label="Detalhes (opcional)"/></ActionForm>:<p>Complete seu perfil para abrir uma solicitação.</p>}</div>
      <div className="card"><h2>Exportar meus dados</h2><p className="muted">Baixe uma cópia dos dados estruturados armazenados neste portal.</p><DownloadButton href="/api/my-data" type="application/json" filename="meus-dados-herbamed.json">Baixar JSON</DownloadButton></div>
    </div></div></>;
}
