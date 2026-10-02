'use client';
import { useRef, useState } from 'react';
import type { z } from 'zod';
import { EntryFields } from './entry-fields';
import { EntryDescription } from './entry-description';
import { entryKinds, entrySchema, entryDetails, entryPeriod, type EntryKind } from './details';

type DraftEntry = z.output<typeof entrySchema>;
function DraftCard({ kind, items, onAdd, onRemove, full }: { kind: EntryKind; items: DraftEntry[]; onAdd: (entry: DraftEntry) => void; onRemove: (index: number) => void; full: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  function add() {
    if (full) { setError('O currículo já possui 50 informações. Remova uma antes de adicionar outra.'); return; }
    const values: Record<string, string> = {};
    container.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea').forEach(field => { values[field.name.replace(`draft_${kind}_`, '')] = field.value; });
    const parsed = entrySchema.safeParse(values);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const labels: Record<string, string> = { title: 'cargo, curso ou idioma (mínimo de 2 caracteres)', organization: 'empresa ou instituição (mínimo de 2 caracteres)', duration_hours: 'carga horária' };
      setError(['end_date'].includes(String(issue.path[0])) ? issue.message : `Verifique ${labels[String(issue.path[0])] || 'os dados desta informação'}.`);
      return;
    }
    onAdd(parsed.data); setVersion(version + 1); setError('');
  }
  return <section className="curriculum-section" aria-label={entryKinds[kind]}>
    <h3>{entryKinds[kind]}</h3>
    {items.length ? <ul className="curriculum-entry-list">{items.map((entry,index)=><li key={index}><div><strong>{entry.title}</strong>{entry.organization && <p>{entry.organization}</p>}{entryDetails(entry) && <p className="muted">{entryDetails(entry)}</p>}{entryPeriod(entry)&&<p>{entryPeriod(entry)}</p>}<EntryDescription value={entry.description} /></div><button type="button" className="button outlined" aria-label={`Remover ${entry.title}`} onClick={()=>onRemove(index)}>Remover</button></li>)}</ul> : <p className="muted">Nenhuma informação adicionada.</p>}
    <details><summary>Adicionar {kind === 'language' ? 'idioma' : kind === 'experience' ? 'experiência' : kind === 'education' ? 'formação' : kind === 'certification' ? 'certificado' : 'curso'}</summary>
      <div ref={container} key={version} className="entry-draft" data-entry-draft onInputCapture={event => { if (event.target instanceof HTMLInputElement) event.target.setCustomValidity(''); }} onKeyDown={event => { if (!event.defaultPrevented && event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.target.closest('.editable-list')) { event.preventDefault(); add(); } }}>
        <EntryFields fixedKind={kind} prefix={`draft_${kind}_`} draft />
        <p className="muted">Preencha e clique em Adicionar para incluir nesta seção. O currículo completo será salvo ao final.</p>
        {error && <p className="alert danger" role="alert">{error}</p>}
        <button type="button" className="button tonal" onClick={add} disabled={full}>Adicionar</button>
      </div>
    </details>
  </section>;
}

export function CurriculumEntryCards() {
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  return <section><h2>Trajetória profissional e acadêmica</h2><p className="muted">Adicione quantas informações precisar nas seções abaixo (até 50 no total). Todas são opcionais no cadastro inicial.</p>
    <input type="hidden" name="initial_entries" value={JSON.stringify(entries)} />
    <div className="curriculum-section-grid">{(Object.keys(entryKinds) as EntryKind[]).map(kind=><DraftCard key={kind} kind={kind} items={entries.filter(entry=>entry.kind===kind)} full={entries.length>=50} onAdd={entry=>setEntries([...entries,entry])} onRemove={index=>{const target=entries.filter(entry=>entry.kind===kind)[index];setEntries(entries.filter(entry=>entry!==target));}} />)}</div>
  </section>;
}
