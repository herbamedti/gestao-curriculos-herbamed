import { session } from '@/modules/auth/session';
import { PageHeading, Empty, date } from '@/ui/common';
import { ActionForm, Field, Hidden, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';
export default async function CandidateMessages() {
  const {client,user}=await session();
  const {data:profile}=await client.from('candidates').select('id').eq('user_id',user.id).maybeSingle();
  const {data:messages}=profile?await client.from('messages').select('*').eq('candidate_id',profile.id).order('created_at',{ascending:false}):{data:[]};
  return <><PageHeading eyebrow="COMUNICAÇÃO" title="Mensagens" description="Suas conversas com a equipe Herbamed em um só lugar."/><div className="split"><div className="card"><h2>Histórico</h2>{messages?.length?messages.map(m=><article className="message" key={m.id}><strong>{m.subject}</strong><p>{m.body}</p><small>{m.sender_id===user.id?'Você':'Equipe Herbamed'} · {date(m.created_at,true)}</small></article>):<Empty title="Nenhuma mensagem" description="Quando houver uma atualização, ela aparecerá aqui." icon="chat_bubble_outline"/>}</div><div className="card"><h2>Enviar mensagem</h2>{profile?<ActionForm action={mutate} submit="Enviar"><Hidden name="op" value="message"/><Hidden name="candidate_id" value={profile.id}/><Field name="subject" label="Assunto" required maxLength={160}/><TextArea name="body" label="Mensagem" required/></ActionForm>:<p>Crie seu perfil para enviar uma mensagem.</p>}</div></div></>;
}
