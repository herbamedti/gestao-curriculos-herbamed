'use client';
import Link from '@/ui/link';
import { useTransition } from 'react';
import { Spinner } from '@/ui/pending-feedback';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <main id="conteudo" className="container page-section">
      <div className="empty">
        <h1>Não foi possível carregar esta página</h1>
        <p>
          O serviço pode estar temporariamente indisponível. Seus dados salvos continuam
          preservados.
        </p>
        <button
          className="button primary"
          disabled={pending}
          aria-busy={pending}
          onClick={() => startTransition(() => reset())}
        >
          {pending ? (
            <>
              <Spinner />
              Carregando…
            </>
          ) : (
            'Tentar novamente'
          )}
        </button>
        <Link href="/">Voltar ao início</Link>
      </div>
    </main>
  );
}
