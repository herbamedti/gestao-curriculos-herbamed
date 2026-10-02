'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { prepareListItems } from './list-items';

export function EditableList({ name, label, initial = [], maxItems = 50, maxLength = 300, chips = false, bulk = false, inputLabel, placeholder, resetOnFormReset = false }: {
  name: string; label: string; initial?: string[]; maxItems?: number; maxLength?: number; chips?: boolean; bulk?: boolean; inputLabel?: string; placeholder?: string; resetOnFormReset?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!resetOnFormReset) return;
    const form = input.current?.closest('form');
    const reset = () => { setItems(initial); setDraft(''); setError(''); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [initial, resetOnFormReset]);
  function add() {
    const result = prepareListItems(draft, items, maxItems, maxLength, bulk);
    if (result.error) { setError(result.error); return; }
    input.current?.setCustomValidity('');
    setItems(result.items); setDraft(''); setError('');
  }
  return <section className="editable-list" aria-labelledby={`${id}-label`}>
    <h3 id={`${id}-label`}>{label}</h3>
    <input type="hidden" data-list-value name={name} value={chips ? JSON.stringify(items) : items.join('\n')} />
    <div className="list-input-row"><label className="field" htmlFor={id}><span>{inputLabel || (chips ? 'Nova habilidade' : `Adicionar item em ${label.toLowerCase()}`)}</span>
      <input ref={input} data-list-draft id={id} aria-describedby={`${id}-help`} value={draft} maxLength={maxLength} onChange={event => { event.currentTarget.setCustomValidity(''); setDraft(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder={placeholder || (bulk ? 'Ex.: Primeiro item; Segundo item; Terceiro item' : chips ? 'Ex.: Excel, comunicação, Python' : 'Digite um item e clique em Adicionar')} />
    </label><button type="button" className="button tonal" onClick={add} disabled={items.length >= maxItems}>Adicionar</button></div>
    <p id={`${id}-help`} className="muted list-help">Clique em Adicionar ou pressione Enter para incluir o texto antes de salvar.{bulk && ' Para adicionar vários itens de uma vez, separe-os por ; (ponto e vírgula). Itens repetidos não são duplicados.'}</p>
    {error && <p className="alert danger" role="alert">{error}</p>}
    {items.length ? <ul className={chips ? 'skill-cards' : 'editable-items'}>{items.map((item, index) => <li key={index}>
      {chips ? <span>{item}</span> : <label className="field"><span className="sr-only">{label}: item {index + 1}</span><input value={item} maxLength={maxLength} required onChange={event => setItems(items.map((value, position) => position === index ? event.target.value : value))} /></label>}
      <button type="button" className="button outlined" aria-label={`Remover ${item}`} onClick={() => setItems(items.filter((_, position) => position !== index))}>Remover</button>
    </li>)}</ul> : <p className="muted">Nenhum item adicionado.</p>}
  </section>;
}
