import { AuthPage } from '@/modules/auth/page';
import { db } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { isConfigured } from '@/lib/config';
export default async function Login({ searchParams }: { searchParams:Promise<Record<string,string>> }) {
  const params = await searchParams;
  if (!params.erro && isConfigured()) {
    const client = await db();
    const { data: { user } } = await client.auth.getUser();
    if (user) redirect('/minha-area');
  }
  return <AuthPage mode="login" error={params.erro} registrationPending={params.cadastro === 'confirmar-email'} staffReady={params.equipe === 'confirmada'}/>;
}
