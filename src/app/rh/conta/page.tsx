import { requireStaff } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { AccountSettings } from '@/ui/account-settings';

export default async function StaffAccount() {
  const { client, user } = await requireStaff();
  const [{ data: staff }, { data: factors }] = await Promise.all([
    client.from('staff').select('display_name,mfa_enabled').eq('user_id', user.id).single(),
    client.auth.mfa.listFactors(),
  ]);
  return <>
    <PageHeading eyebrow="CONFIGURAÇÕES" title="Conta" description="Atualize seus dados e a segurança do acesso de gestão." />
    <AccountSettings name={staff?.display_name || user.user_metadata.full_name || ''} email={user.email || ''} staff mfaEnabled={staff?.mfa_enabled ?? true} factorId={factors?.totp[0]?.id} azure={user.app_metadata.provider === 'azure'} />
  </>;
}
