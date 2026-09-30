import Link from 'next/link';
import { notFound } from 'next/navigation';
import { session } from '@/modules/auth/session';
import { curriculumFields, curriculumMissing } from '@/modules/candidates/profile';
import { PageHeading } from '@/ui/common';
import { ActionForm, Hidden, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';

export default async function Apply({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const {client,user}=await session();
  const {data:job}=await client.from('jobs').select('*').eq('slug',slug).eq('status','published').eq('visibility','public').maybeSingle();
  if(!job)notFound();
  const [{data:profile},{data:policy},{data:questions}]=await Promise.all([
    client.from('candidates').select('*').eq('user_id',user.id).maybeSingle(),
    client.from('privacy_policies').select('id,title,version').eq('active',true).maybeSingle(),
    client.from('job_questions').select('*').eq('job_id',job.id).order('position'),
  ]);
  const [{data:entries},{data:existing}]=await Promise.all([
    profile?client.from('profile_entries').select('kind,title,organization').eq('candidate_id',profile.id):Promise.resolve({data:[]}),
    profile?client.from('applications').select('id').eq('job_id',job.id).eq('candidate_id',profile.id).maybeSingle():Promise.resolve({data:null}),
  ]);
  const missing=curriculumMissing(profile,entries||[]);
  return <main id="conteudo" className="container narrow page-section">
    <Link className="text-link" href={`/vagas/${slug}`}>← Voltar à vaga</Link>
    <PageHeading eyebrow="CANDIDATURA" title={job.title} description="Confira seu currículo e envie sua candidatura." />
    {existing?<div className="alert info">Você já se candidatou a esta vaga. <Link className="text-link" href="/candidato/candidaturas">Acompanhar candidatura</Link></div>:<>
      <div className="card"><h2>Seu currículo na plataforma</h2>
        {missing.length?<><p>Para se candidatar, complete os dados abaixo:</p><ul>{curriculumFields.filter(field=>missing.includes(field.key)).map(field=><li key={field.key}><Link className="text-link" href={`/candidato/perfil?etapa=${field.step}`}>{field.label}</Link></li>)}</ul><Link className="button primary" href="/candidato/perfil?etapa=revisao">Completar meu currículo</Link></>:<><div className="alert success">Currículo completo para candidatura.</div><p>{profile?.full_name} · {profile?.headline} · {profile?.city}</p><Link className="text-link" href="/candidato/perfil?etapa=revisao">Revisar ou exportar currículo</Link></>}
      </div>
      {missing.length===0&&<div className="card"><h2>Enviar candidatura</h2>{policy?<ActionForm action={mutate} submit="Enviar candidatura">
        <Hidden name="op" value="apply" /><Hidden name="job_id" value={job.id} /><Hidden name="policy_id" value={policy.id} />
        {questions?.map(q=><TextArea key={q.id} name={`answer_${q.id}`} label={q.label} required={q.required} />)}
        <label className="check"><input type="checkbox" name="acknowledge" required />Li o <Link className="text-link" href="/privacidade" target="_blank">aviso de privacidade</Link> (versão {policy.version}).</label>
      </ActionForm>:<p>O aviso de privacidade ainda não está disponível. Não é possível enviar a candidatura agora.</p>}</div>}
    </>}
  </main>;
}
