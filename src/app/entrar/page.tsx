import { AuthPage } from '@/modules/auth/page';
export default async function Login({ searchParams }: { searchParams:Promise<Record<string,string>> }) { return <AuthPage mode="login" error={(await searchParams).erro}/>; }
