import Link from '@/ui/link';
import { z } from 'zod';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Badge, Empty, date } from '@/ui/common';
import { ActionForm, Hidden, Select, TextArea } from '@/ui/form';
import { mutate } from '@/modules/actions';
import { PolicyEditor } from '@/modules/privacy/policy-editor';
import { PolicyBody } from '@/modules/privacy/policy-body';
export default async function PrivacyRequests({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; pagina?: string; publicado?: string }>;
}) {
  const { client } = await requirePermission('privacy.read');
  const { data: canEdit } = await client.rpc('has_permission', { p_permission: 'privacy.manage' });
  const params = await searchParams;
  const selectedId = z.uuid().safeParse(params.aviso);
  const parsedPage = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(params.pagina || 1);
  const page = parsedPage.success ? parsedPage.data : 1;
  const [
    { data: requests },
    { data: policy, error: policyError },
    { data: history, error: historyError, count },
  ] = await Promise.all([
    client
      .from('privacy_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    client.from('privacy_policies').select('*').eq('active', true).maybeSingle(),
    client
      .from('privacy_policies')
      .select('id,version,title,published_at,active', { count: 'exact' })
      .order('published_at', { ascending: false })
      .order('id')
      .range((page - 1) * 20, page * 20 - 1),
  ]);
  const selected =
    selectedId.success && selectedId.data !== policy?.id
      ? await client.from('privacy_policies').select('*').eq('id', selectedId.data).maybeSingle()
      : { data: policy, error: policyError };
  const source = selected.data;
  const historyHref = (number: number) =>
    `?${new URLSearchParams({ pagina: String(number), ...(selectedId.success ? { aviso: selectedId.data } : {}) })}#historico-avisos`;
  const ids = requests?.map((r) => r.candidate_id) || [];
  const people = ids.length
    ? (await client.from('candidates').select('id,full_name').in('id', ids)).data
    : [];
  return (
    <>
      <PageHeading
        eyebrow="PRIVACIDADE E SEGURANÇA"
        title="Privacidade"
        description="Publique o aviso aprovado e trate as solicitações dos titulares."
      />
      {params.publicado === '1' && selectedId.success && source?.id === selectedId.data && (
        <div role="status" className="alert success">
          Nova versão publicada. O texto e as ciências das versões anteriores permanecem no
          histórico.
        </div>
      )}
      <section className="card privacy-policy-card" id="aviso-editor">
        <h2>Aviso de privacidade</h2>
        <p className="muted">
          {policy
            ? `Versão ativa: ${policy.version} — ${policy.title} (publicada em ${date(policy.published_at, true)}).`
            : 'Nenhum aviso ativo. Candidaturas ficam bloqueadas até a publicação.'}
        </p>
        <p className="muted">
          Use apenas o texto aprovado pela Herbamed para este ambiente. Uma nova versão substitui a
          anterior para novas candidaturas e preserva o histórico de ciência.
        </p>
        <p className="muted">
          Cada publicação cria uma versão independente. Para corrigir um aviso, use o texto anterior
          como base e publique uma nova versão com outro identificador.
        </p>
        {policyError && (
          <div role="alert" className="alert danger">
            Não foi possível consultar o aviso ativo. Atualize a página antes de publicar.
          </div>
        )}
        {(selected.error || (params.aviso && (!selectedId.success || !source))) && (
          <div role="alert" className="alert danger">
            Não foi possível carregar a versão solicitada. Selecione um aviso no histórico.
          </div>
        )}
        {canEdit && <PolicyEditor
          key={source?.id || 'new-policy'}
          title={source?.title}
          body={source?.body}
          sourceVersion={source?.version}
        />}
        <Link className="text-link" href="/privacidade" target="_blank" rel="noopener noreferrer">
          Ver aviso público vigente
        </Link>
      </section>
      <section className="card privacy-policy-card" id="historico-avisos">
        <h2>Histórico de avisos</h2>
        <p className="muted">
          As versões publicadas não são editadas nem apagadas. A ciência registrada em cada
          candidatura continua vinculada à versão correspondente.
        </p>
        {historyError ? (
          <div role="alert" className="alert danger">
            Não foi possível carregar o histórico de avisos.
          </div>
        ) : history?.length ? (
          <ol className="policy-history">
            {history.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>
                    Versão {item.version} — {item.title}
                  </strong>
                  <p className="muted">{date(item.published_at, true)}</p>
                </div>
                <Badge tone={item.active ? 'green' : 'pending'}>
                  {item.active ? 'Vigente' : 'Anterior'}
                </Badge>
                <Link className="text-link" href={`?aviso=${item.id}&pagina=${page}#aviso-editor`}>
                  Consultar / usar como base
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Nenhum aviso publicado.</p>
        )}
        {count && count > 20 ? (
          <div className="pagination">
            {page > 1 && <Link href={historyHref(page - 1)}>Anterior</Link>}
            <span>
              {count} versões · Página {page}
            </span>
            {page * 20 < count && <Link href={historyHref(page + 1)}>Próxima</Link>}
          </div>
        ) : null}
        {source && (
          <details className="policy-history-preview">
            <summary>Consultar texto publicado da versão {source.version}</summary>
            <PolicyBody body={source.body} />
          </details>
        )}
      </section>
      <section className="card">
        <h2>Solicitações dos titulares</h2>
        {requests?.length ? (
          requests.map((r) => (
            <article className="message" key={r.id}>
              <div className="card-header">
                <div>
                  <strong>
                    {people?.find((p) => p.id === r.candidate_id)?.full_name || 'Titular'} ·{' '}
                    {r.kind}
                  </strong>
                  <p className="muted">
                    Protocolo {r.id} · {date(r.created_at, true)}
                  </p>
                </div>
                <Badge>{r.status}</Badge>
              </div>
              <p>{r.detail}</p>
              <Link className="text-link" href={`/rh/candidatos/${r.candidate_id}`}>
                Ver perfil
              </Link>
              {canEdit && <ActionForm action={mutate} submit="Registrar decisão">
                <Hidden name="op" value="resolve-privacy" />
                <Hidden name="id" value={r.id} />
                <Select name="status" label="Situação" value={r.status}>
                  <option value="reviewing">Em análise</option>
                  <option value="completed">Concluída</option>
                  <option value="denied">Indeferida</option>
                </Select>
                <TextArea name="resolution" label="Fundamentação e providências" required />
              </ActionForm>}
            </article>
          ))
        ) : (
          <Empty
            title="Nenhuma solicitação"
            description="Os pedidos de titulares aparecerão neste painel."
            icon="shield"
          />
        )}
      </section>
    </>
  );
}
