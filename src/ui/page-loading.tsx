import { Spinner } from './pending-feedback';

export function PageLoading() {
  return (
    <section className="page-loading" aria-busy="true" aria-label="Carregamento da página">
      <div className="page-loading-heading" role="status">
        <Spinner />
        <div>
          <strong>Carregando página…</strong>
          <p>Estamos preparando as informações.</p>
        </div>
      </div>
      <div className="page-loading-skeletons" aria-hidden="true">
        <div className="skeleton loading-title" />
        <div className="skeleton loading-line" />
        <div className="skeleton loading-card" />
        <div className="skeleton loading-card" />
      </div>
    </section>
  );
}
