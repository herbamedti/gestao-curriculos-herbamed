'use client';
import { useRef, useState } from 'react';
import { Icon } from './icon';

export function CopyLink({ url }: { url: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Link copiado. Cole na sua publicação ou mensagem.');
    } catch {
      field.current?.focus(); field.current?.select();
      setMessage('Selecione e copie o link do campo acima.');
    } finally { setBusy(false); }
  }
  return <div className="copy-link-control">
    <label className="field"><span>Link público da vaga</span><input ref={field} type="url" readOnly value={url} onFocus={event => event.currentTarget.select()} /></label>
    <button type="button" className="button outlined" onClick={() => void copy()} disabled={busy}><Icon name="content_copy" />{busy ? 'Copiando…' : 'Copiar link'}</button>
    <span className="muted copy-link-message" role="status" aria-live="polite">{message}</span>
  </div>;
}
