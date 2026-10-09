import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { Brand } from '@/ui/brand';
import { ActionForm, Field } from '@/ui/form';
import { finishStaffOnboarding } from '@/modules/auth/staff-onboarding';
import Link from '@/ui/link';

export default async function FirstStaffAccess() {
  const client = await db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/entrar');
  const status = await client.rpc('candidate_registration_status');
  if (status.error || status.data === 'unavailable') redirect('/conta-indisponivel');
  if (status.data !== 'password_required') redirect('/entrar');
  return <main className="first-access"><section className="card"><Brand />
    <p className="eyebrow">EQUIPE HERBAMED</p><h1>Crie sua senha de acesso</h1>
    <p className="muted">Seu e-mail foi confirmado. Defina uma senha pessoal para concluir o convite e entrar na plataforma.</p>
    <ActionForm action={finishStaffOnboarding} submit="Concluir meu acesso" pendingLabel="Concluindo acesso…">
      <Field name="email" label="E-mail confirmado" type="email" value={user.email} readOnly />
      <Field name="password" label="Nova senha" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
      <Field name="confirm_password" label="Confirmar nova senha" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
      <p className="muted">Use de 12 a 128 caracteres, incluindo maiúsculas, minúsculas, números e símbolos. A verificação em duas etapas será solicitada no login quando estiver exigida para sua conta.</p>
    </ActionForm><Link className="text-link" href="/entrar">Voltar para entrar</Link>
  </section></main>;
}
