import type { Database } from '@/lib/database.types';
import { ActionForm, Hidden } from '@/ui/form';
import { mutate } from '@/modules/actions';
import { EntryFields } from './entry-fields';
import { EntryDescription } from './entry-description';
import { entryKinds, entryDetails, entryPeriod, type EntryKind } from './details';

type Entry = Database['public']['Tables']['profile_entries']['Row'];
export function TrajectoryCards({ candidateId, entries, canEdit = true }: { candidateId: string; entries: Entry[]; canEdit?: boolean }) {
  return <div className="curriculum-section-grid">{(Object.keys(entryKinds) as EntryKind[]).map(kind=><section className="curriculum-section" key={kind} aria-label={entryKinds[kind]}>
    <h3>{entryKinds[kind]}</h3>
    {entries.filter(entry=>entry.kind===kind).map(entry=><div className="message" key={entry.id}><strong>{entry.title}</strong>{entry.organization&&<p>{entry.organization}</p>}{entryDetails(entry)&&<p className="muted">{entryDetails(entry)}</p>}{entryPeriod(entry)&&<p>{entryPeriod(entry)}</p>}<EntryDescription value={entry.description} />
      {canEdit && <><details><summary>Editar informação</summary><ActionForm action={mutate} submit="Salvar alteração"><Hidden name="op" value="edit-entry" /><Hidden name="candidate_id" value={candidateId} /><Hidden name="entry_id" value={entry.id} /><EntryFields entry={entry} fixedKind={kind} /></ActionForm></details>
        <ActionForm action={mutate} submit="Remover informação" confirm="Remover esta informação do currículo?"><Hidden name="op" value="delete-entry" /><Hidden name="candidate_id" value={candidateId} /><Hidden name="entry_id" value={entry.id} /></ActionForm></>}
    </div>)}
    {!entries.some(entry=>entry.kind===kind)&&<p className="muted">Nenhuma informação registrada.</p>}
    {canEdit && <details><summary>Adicionar {kind === 'language' ? 'idioma' : kind === 'experience' ? 'experiência' : kind === 'education' ? 'formação' : kind === 'certification' ? 'certificado' : 'curso'}</summary><ActionForm action={mutate} submit="Adicionar ao currículo"><Hidden name="op" value="entry" /><Hidden name="candidate_id" value={candidateId} /><EntryFields fixedKind={kind} /></ActionForm></details>}
  </section>)}</div>;
}
