import Link from '@/ui/link';
import { db } from '@/lib/supabase';
import { mutate } from '@/modules/actions';
import { ActionForm, Hidden } from '@/ui/form';

export async function TalentPreference({ profile }: { profile: { id: string; talent_pool: boolean } | null }) {
  const client = await db();
  const { data: policy, error } = await client.from('privacy_policies').select('id,title,version').eq('active', true).lte('published_at', new Date().toISOString()).maybeSingle();
  return <section className="talent-preference" aria-label="Participação no banco de talentos">
    <h3>Banco de talentos</h3>
    <p className="muted">Esta escolha permite ao RH considerar seu currículo para futuras oportunidades. Salvar o currículo ou se candidatar não ativa essa participação.</p>
    {!profile ? <p>Salve seu currículo para escolher a participação.</p> : error ? <p role="alert">Não foi possível consultar o aviso de privacidade. Tente novamente mais tarde.</p> : !policy ? <div className="alert info">A participação estará disponível quando a Herbamed publicar o aviso de privacidade.</div> : <ActionForm action={mutate} submit="Salvar participação">
      <Hidden name="op" value="privacy-consent" /><Hidden name="policy_id" value={policy.id} />
      <label className="check"><input type="checkbox" name="talent_pool" defaultChecked={profile.talent_pool} /><span>Quero participar do banco de talentos</span></label>
      <p className="muted">{profile.talent_pool ? 'Participação autorizada.' : 'Sua participação ainda não está autorizada.'} <Link className="text-link" href="/privacidade" target="_blank" rel="noreferrer">Ler aviso — versão {policy.version}</Link></p>
    </ActionForm>}
  </section>;
}
