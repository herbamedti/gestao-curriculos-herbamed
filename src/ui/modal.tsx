'use client';
import { useEffect, useId, useRef } from 'react';
import { Icon } from './icon';

export function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  function close() { if (!ref.current?.querySelector('form[aria-busy="true"]')) onClose(); }
  return <dialog ref={ref} className={`admin-modal ${wide ? 'admin-modal-wide' : ''}`} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }}>
    <header className="admin-modal-header"><div><h2 id={`${id}-title`}>{title}</h2>{description && <p id={`${id}-description`} className="muted">{description}</p>}</div>
      <button type="button" className="icon-button" aria-label="Fechar janela" onClick={close}><Icon name="close" /></button></header>
    <div className="admin-modal-body">{children}</div>
  </dialog>;
}
