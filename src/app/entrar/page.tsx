import { AuthPage } from '@/modules/auth/page';
export default async function Login({ searchParams }: { searchParams:Promise<Record<string,string>> }) {
  const params = await searchParams;
  return <AuthPage mode="login" error={params.erro} registrationPending={params.cadastro === 'confirmar-email'}/>;
}
