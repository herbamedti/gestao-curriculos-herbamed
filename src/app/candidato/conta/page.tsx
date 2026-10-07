import { session } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { AccountSettings } from '@/ui/account-settings';
import { features } from '@/lib/config';
import { z } from 'zod';

export default async function CandidateAccount() {
  const { client, user } = await session();
  const [{ data: candidate }, { data: factors }, { data: registration }] = await Promise.all([
    client.from('candidates').select('full_name').eq('user_id', user.id).maybeSingle(),
    client.auth.mfa.listFactors(),
    client.rpc('my_registration'),
  ]);
  const identification = z.object({cpf_masked:z.string(),birth_date:z.string()}).safeParse(registration);
  return <>
    <PageHeading eyebrow="CONFIGURAÇÕES" title="Conta" description="Atualize seus dados e a segurança do seu acesso." />
    {identification.success && <section className="card"><h2>Dados do cadastro</h2><p>CPF: {identification.data.cpf_masked}</p><p>Data de nascimento: {identification.data.birth_date.split('-').reverse().join('/')}</p><p className="muted">Para corrigir esses dados, solicite a correção na seção Privacidade.</p></section>}
    <AccountSettings name={candidate?.full_name || user.user_metadata.full_name || ''} email={user.email || ''} staff={false} mfaEnabled={false} factorId={factors?.totp[0]?.id} azure={user.app_metadata.provider === 'azure'} emailEnabled={features.email} />
  </>;
}
