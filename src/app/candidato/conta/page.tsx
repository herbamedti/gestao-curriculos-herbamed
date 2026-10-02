import { session } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { AccountSettings } from '@/ui/account-settings';
import { features } from '@/lib/config';

export default async function CandidateAccount() {
  const { client, user } = await session();
  const [{ data: candidate }, { data: factors }] = await Promise.all([
    client.from('candidates').select('full_name').eq('user_id', user.id).maybeSingle(),
    client.auth.mfa.listFactors(),
  ]);
  return <>
    <PageHeading eyebrow="CONFIGURAÇÕES" title="Conta" description="Atualize seus dados e a segurança do seu acesso." />
    <AccountSettings name={candidate?.full_name || user.user_metadata.full_name || ''} email={user.email || ''} staff={false} mfaEnabled={false} factorId={factors?.totp[0]?.id} azure={user.app_metadata.provider === 'azure'} emailEnabled={features.email} />
  </>;
}
