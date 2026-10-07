import { PublicShell } from '@/ui/public-shell';
import { db } from '@/lib/supabase';
import { isConfigured } from '@/lib/config';
import { PageHeading, date } from '@/ui/common';
import { PolicyBody } from '@/modules/privacy/policy-body';
export default async function Privacy() {
  const policy = isConfigured()
    ? (
        await (
          await db()
        )
          .from('privacy_policies')
          .select('*')
          .eq('active', true)
          .lte('published_at', new Date().toISOString())
          .maybeSingle()
      ).data
    : null;
  return (
    <PublicShell>
      <div className="container narrow page-section">
        <PageHeading
          eyebrow="TRANSPARÊNCIA"
          title="Aviso de privacidade"
          description="Informações sobre o tratamento de dados pessoais no portal de carreiras."
        />
        {policy ? (
          <article className="card">
            <p className="muted">
              Versão {policy.version} · Publicado em {date(policy.published_at)}
            </p>
            <h2>{policy.title}</h2>
            <PolicyBody body={policy.body} />
          </article>
        ) : (
          <div className="alert info">
            O aviso de privacidade ainda está em preparação. O envio de candidaturas ficará
            indisponível até sua publicação.
          </div>
        )}
      </div>
    </PublicShell>
  );
}
