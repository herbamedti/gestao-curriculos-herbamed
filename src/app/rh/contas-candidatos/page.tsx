import Form from 'next/form';
import { SubmitButton } from '@/ui/submit-button';
import Link from '@/ui/link';
import { z } from 'zod';
import { requirePermission } from '@/modules/auth/session';
import { managePortalAccount } from '@/modules/auth/portal-accounts';
import { PageHeading, Badge, Empty, date } from '@/ui/common';
import { ActionForm, Hidden, TextArea } from '@/ui/form';

export default async function PortalAccounts({ searchParams }: { searchParams: Promise<{ q?: string; active?: string; page?: string }> }) {
  const { client } = await requirePermission('users.manage');
  const params = await searchParams;
  const filters = z.object({ q: z.string().max(100).default(''), active: z.enum(['', 'true', 'false']).default(''), page: z.coerce.number().int().min(1).max(10000).default(1) }).safeParse(params);
  const p = filters.success ? filters.data : { q: '', active: '' as const, page: 1 };
  const { data: accounts, error } = await client.rpc('list_portal_accounts', { p_search: p.q, p_active: p.active ? p.active === 'true' : undefined, p_page: p.page });
  const total = accounts?.[0]?.total_count || 0;
  const href = (page: number) => `?${new URLSearchParams({ q: p.q, active: p.active, page: String(page) })}`;
  return <>
    <PageHeading eyebrow="ADMINISTRAÇÃO" title="Contas de candidatos" description="Gerencie o acesso das pessoas cadastradas no portal, inclusive aquelas que ainda não montaram o currículo." />
    <Form className="search-bar portal-account-filters" action="/rh/contas-candidatos">
      <label className="field"><span>Nome ou e-mail</span><input name="q" defaultValue={p.q} maxLength={100} placeholder="Buscar conta" /></label>
      <label className="field"><span>Acesso</span><select name="active" defaultValue={p.active}><option value="">Todos</option><option value="true">Ativo</option><option value="false">Desativado</option></select></label>
      <SubmitButton className="button primary" pendingLabel="Buscando…">Filtrar</SubmitButton>
    </Form>
    <p className="muted">Desativar bloqueia o uso da plataforma e as sessões anteriores. Currículo e histórico são preservados. Após reativar, é necessário um novo login.</p>
    {error ? <div role="alert" className="alert danger">Não foi possível carregar as contas. Confira se a migração de gestão de contas foi aplicada.</div> : accounts?.length ? <div className="portal-accounts">
      {accounts.map(account => <article className="card portal-account" key={account.user_id}>
        <div className="card-header"><div><h2>{account.display_name || 'Currículo ainda não cadastrado'}</h2><p className="muted">{account.email}</p></div><Badge tone={account.active ? 'green' : 'pending'}>{account.active ? 'Acesso ativo' : 'Acesso desativado'}</Badge></div>
        <dl className="portal-account-info"><div><dt>Cadastro</dt><dd>{date(account.created_at)}</dd></div><div><dt>E-mail</dt><dd>{account.confirmed_at ? 'Confirmado' : 'Aguardando confirmação'}</dd></div><div><dt>Último login</dt><dd>{account.last_sign_in_at ? date(account.last_sign_in_at, true) : 'Ainda não entrou'}</dd></div><div><dt>Banco de talentos</dt><dd>{account.talent_pool ? 'Participação autorizada' : 'Sem participação autorizada'}</dd></div></dl>
        {account.reason && <p className="muted">Motivo da última alteração: {account.reason}</p>}
        {account.candidate_id && <Link className="text-link" href={`/rh/candidatos/${account.candidate_id}`}>Ver currículo</Link>}
        <details><summary>{account.active ? 'Desativar acesso' : 'Reativar acesso'}</summary>
          <ActionForm action={managePortalAccount} submit={account.active ? 'Desativar acesso' : 'Reativar acesso'} confirm={account.active ? 'Desativar o acesso desta conta e bloquear suas sessões existentes?' : 'Reativar o acesso desta conta? O candidato precisará entrar novamente.'}>
            <Hidden name="user_id" value={account.user_id} /><Hidden name="active" value={String(!account.active)} />
            <TextArea name="reason" label="Motivo da alteração (3 a 1.000 caracteres)" required rows={3} />
          </ActionForm>
        </details>
      </article>)}
    </div> : <Empty title="Nenhuma conta encontrada" description="Confira os filtros. Usuários internos são administrados na tela da equipe." icon="person_search" />}
    {accounts?.length ? <div className="pagination">{p.page > 1 && <Link href={href(p.page - 1)}>Anterior</Link>}<span>{total} contas · Página {p.page}</span>{p.page * 20 < total && <Link href={href(p.page + 1)}>Próxima</Link>}</div> : null}
  </>;
}
