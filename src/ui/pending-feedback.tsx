'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { useLinkStatus } from 'next/link';

const Reporter = createContext<(id: string, pending: boolean) => void>(() => {});
const Busy = createContext(false);

export function Spinner() {
  return <span className="loading-spinner" aria-hidden="true" />;
}

export function NavigationFeedback({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<string[]>([]);
  const report = useCallback((id: string, pending: boolean) => {
    setLinks((current) =>
      pending
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.includes(id)
          ? current.filter((item) => item !== id)
          : current,
    );
  }, []);
  const busy = links.length > 0;
  return (
    <Reporter.Provider value={report}>
      <Busy.Provider value={busy}>
        <div className="app-feedback" data-navigating={busy}>
          <div className="navigation-progress" aria-hidden="true" />
          <div className="navigation-status" role="status" aria-live="polite" aria-atomic="true">
            {busy && (
              <>
                <Spinner />
                <span>Carregando página…</span>
              </>
            )}
          </div>
          {children}
        </div>
      </Busy.Provider>
    </Reporter.Provider>
  );
}

export function LinkFeedback() {
  const { pending } = useLinkStatus();
  const report = useContext(Reporter);
  const id = useId();
  useEffect(() => {
    if (pending) report(id, true);
    return () => report(id, false);
  }, [id, pending, report]);
  return (
    <span className="link-feedback" data-pending={pending} aria-hidden="true">
      {pending && <Spinner />}
    </span>
  );
}

export function NavigationContent({ children }: { children: ReactNode }) {
  const busy = useContext(Busy);
  return (
    <main className="workspace-content" id="conteudo" aria-busy={busy} inert={busy}>
      {children}
    </main>
  );
}
