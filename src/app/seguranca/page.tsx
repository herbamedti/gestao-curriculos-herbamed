import { session } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { MfaSetup } from '@/ui/mfa';
export default async function Security() {
  const {client}=await session();
  const [{data:factors},{data:aal}]=await Promise.all([client.auth.mfa.listFactors(),client.auth.mfa.getAuthenticatorAssuranceLevel()]);
  return <main id="conteudo" className="container narrow page-section"><PageHeading eyebrow="SUA CONTA" title="Segurança do acesso" description="Gerencie a autenticação em duas etapas."/>{aal?.currentLevel==='aal2'&&<p className="alert success">Sua sessão está protegida com autenticação em duas etapas.</p>}<MfaSetup existing={factors?.totp[0]?.id}/></main>;
}
