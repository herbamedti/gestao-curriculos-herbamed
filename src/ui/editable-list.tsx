'use client';
import { useId, useRef, useState } from 'react';

export function EditableList({ name, label, initial = [], maxItems = 50, maxLength = 300, chips = false }: {
  name: string; label: string; initial?: string[]; maxItems?: number; maxLength?: number; chips?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  function add() {
    const value = draft.trim();
    if (!value) { setError('Digite um item antes de adicionar.'); return; }
    if (items.some(item => item.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'))) { setError('Este item já foi adicionado.'); return; }
    if (items.length >= maxItems) { setError(`Adicione no máximo ${maxItems} itens.`); return; }
    input.current?.setCustomValidity('');
    setItems([...items, value]); setDraft(''); setError('');
  }
  return <section className="editable-list" aria-labelledby={`${id}-label`}>
    <h3 id={`${id}-label`}>{label}</h3>
    <input type="hidden" name={name} value={chips ? JSON.stringify(items) : items.join('\n')} />
    <div className="list-input-row"><label className="field" htmlFor={id}><span>{chips ? 'Nova habilidade' : `Adicionar item em ${label.toLowerCase()}`}</span>
      <input ref={input} data-list-draft id={id} value={draft} maxLength={maxLength} onChange={event => { event.currentTarget.setCustomValidity(''); setDraft(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder={chips ? 'Ex.: Excel, comunicação, Python' : 'Digite um item e clique em Adicionar'} />
    </label><button type="button" className="button tonal" onClick={add} disabled={items.length >= maxItems}>Adicionar</button></div>
    {draft.trim() && <p className="muted">Clique em Adicionar ou pressione Enter para incluir o texto antes de salvar.</p>}
    {error && <p className="alert danger" role="alert">{error}</p>}
    {items.length ? <ul className={chips ? 'skill-cards' : 'editable-items'}>{items.map((item, index) => <li key={index}>
      {chips ? <span>{item}</span> : <label className="field"><span className="sr-only">{label}: item {index + 1}</span><input value={item} maxLength={maxLength} required onChange={event => setItems(items.map((value, position) => position === index ? event.target.value : value))} /></label>}
      <button type="button" className="button outlined" aria-label={`Remover ${item}`} onClick={() => setItems(items.filter((_, position) => position !== index))}>Remover</button>
    </li>)}</ul> : <p className="muted">Nenhum item adicionado.</p>}
  </section>;
}
