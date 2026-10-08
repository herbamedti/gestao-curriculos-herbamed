'use client';
import { useRef, useState } from 'react';
import { Spinner } from './pending-feedback';

export function DownloadButton({
  href,
  filename,
  type,
  children,
}: {
  href: string;
  filename: string;
  type: 'application/pdf' | 'application/json' | 'text/csv';
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  async function download() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(href, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== type)
        throw new Error('download_unavailable');
      const file = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const name = disposition?.match(/filename="([^"]+)"/)?.[1] || filename;
      const url = URL.createObjectURL(file);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = name.slice(0, 200).replace(/[\\/\u0000-\u001f]/g, '_');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }
      setMessage('Download iniciado. Confira os downloads do navegador.');
    } catch {
      setMessage('Não foi possível preparar o arquivo. Tente novamente.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <span className="download-control">
      <button
        type="button"
        className="button outlined"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void download()}
      >
        {busy ? (
          <>
            <Spinner />
            <span>Preparando arquivo…</span>
          </>
        ) : (
          children
        )}
      </button>
      <span className="download-message" role="status" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
