'use client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initialResult, type ActionResult } from '@/lib/result';
export function ActionForm({ action, children, submit = 'Salvar alterações', className = '', confirm }: {
  action: (state: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode; submit?: React.ReactNode; className?: string; confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialResult);
  const [draftError, setDraftError] = useState('');
  const router = useRouter();
  useEffect(() => { if (state.ok && state.redirect) router.push(state.redirect); }, [state, router]);
  return <form action={formAction} className={`form ${className}`} onSubmit={e => {
    setDraftError('');
    const draft=Array.from(e.currentTarget.querySelectorAll<HTMLInputElement>('input[data-list-draft]')).find(input=>input.value.trim());
    if(draft){e.preventDefault();draft.setCustomValidity('Clique em Adicionar ou pressione Enter para incluir este item antes de salvar.');draft.reportValidity();return;}
    const entryDraft=Array.from(e.currentTarget.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[data-entry-draft] input:not([type=hidden]),[data-entry-draft] input[data-list-value],[data-entry-draft] textarea,[data-entry-draft] select')).find(field=>field.value.trim());
    if(entryDraft){e.preventDefault();const section=entryDraft.closest('details');if(section)section.open=true;setDraftError('Há uma informação de trajetória em preenchimento. Clique em Adicionar nessa seção ou limpe os campos antes de salvar o currículo.');entryDraft.focus();return;}
    if (confirm && !window.confirm(confirm)) e.preventDefault();
  }}>
    {children}
    {draftError && <div role="alert" className="alert danger">{draftError}</div>}
    {state.message && <div role={state.ok ? 'status' : 'alert'} className={`alert ${state.ok ? 'success' : 'danger'}`}>{state.message}</div>}
    <button className="button primary" disabled={pending} type="submit">{pending ? 'Salvando…' : submit}</button>
  </form>;
}
export function Field({ label, name, type = 'text', required, value, placeholder, ...props }: {
  label: string; name: string; type?: string; required?: boolean; value?: string | number; placeholder?: string;
  maxLength?: number; minLength?: number; min?: number | string; max?: number; autoComplete?: string; readOnly?: boolean;
}) {
  return <label className="field"><span>{label}{required ? ' *' : ''}</span><input name={name} type={type} defaultValue={value} required={required} placeholder={placeholder} {...props} /></label>;
}
export function TextArea({ label, name, value, required, rows = 4 }: { label: string; name: string; value?: string; required?: boolean; rows?: number }) {
  return <label className="field"><span>{label}{required ? ' *' : ''}</span><textarea name={name} defaultValue={value} required={required} rows={rows} maxLength={10000} /></label>;
}
export function Select({ label, name, value, children, required }: { label: string; name: string; value?: string; children: React.ReactNode; required?: boolean }) {
  return <label className="field"><span>{label}</span><select name={name} defaultValue={value} required={required}>{children}</select></label>;
}
export function Hidden({ name, value }: { name: string; value: string }) { return <input type="hidden" name={name} value={value} />; }
