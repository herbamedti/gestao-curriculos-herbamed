'use client';
import { useId, useState, type FormEvent } from 'react';
import { Icon } from '@/ui/icon';
import { Spinner } from '@/ui/pending-feedback';
import { postExcerpt } from './post-model';
import { postSections, postSelectionSchema, type PostSectionKind, type PostSelection, type PostSources } from './post-selection';

type Choice = { id: string; text: string; selected: boolean; custom?: boolean };
const choices = (values: string[], prefix: string, count: number): Choice[] => values.map((text, index) => ({ id: `${prefix}-${index}`, text, selected: index < count }));

function TextChoices({ title, noun, rows, onChange, limit, recommended }: {
  title: string; noun: string; rows: Choice[]; onChange: (rows: Choice[]) => void; limit: number; recommended: number;
}) {
  const id = useId();
  const selected = rows.filter(row => row.selected).length;
  function update(row: Choice, change: Partial<Choice>) { onChange(rows.map(item => item.id === row.id ? { ...item, ...change } : item)); }
  function add() {
    const added = crypto.randomUUID();
    onChange([...rows, { id: added, text: '', selected: true, custom: true }]);
    requestAnimationFrame(() => document.getElementById(`${id}-${added}`)?.focus());
  }
  return <section className="post-text-choices" aria-labelledby={`${id}-title`}>
    <div className="post-choice-heading"><h3 id={`${id}-title`}>{title}</h3><span className="muted">{selected} de {limit} selecionados</span></div>
    <p className="muted">Marque os textos que deseja mostrar. Edite o conteúdo dos itens selecionados.</p>
    <div className="post-choice-list">{rows.map((row, index) => {
      const length = row.text.replace(/\s+/g, ' ').trim().length;
      const long = length > recommended;
      const label = `${noun} ${index + 1}`;
      return <div key={row.id} className="post-text-choice" data-selected={row.selected}>
        <div className="post-choice-toolbar"><label className="check"><input type="checkbox" checked={row.selected} disabled={!row.selected && selected >= limit}
          onChange={event => update(row, { selected: event.target.checked })} /><span>Selecionar {label}</span></label>
          {(row.selected || row.custom) && <button type="button" className="icon-button" title="Remover da postagem" aria-label={`Remover ${label} da postagem`}
            onClick={() => row.custom ? onChange(rows.filter(item => item.id !== row.id)) : update(row, { selected: false })}><Icon name="close" /></button>}
        </div>
        {row.selected ? <>
          <div className="field"><label htmlFor={`${id}-${row.id}`}>Texto: {label}</label><textarea id={`${id}-${row.id}`} value={row.text} required rows={2} maxLength={10000}
            aria-describedby={`${id}-${row.id}-help`} onChange={event => update(row, { text: event.target.value })} /></div>
          <p id={`${id}-${row.id}-help`} className={long ? 'post-text-warning' : 'muted post-text-count'} role={long ? 'status' : undefined}>
            {long ? `Texto muito longo: ${length} caracteres. Recomendamos até ${recommended}. Reduza para facilitar a leitura; ele poderá ser resumido na imagem.` : `${length}/${recommended} caracteres recomendados.`}
          </p>
        </> : <p className="post-choice-original">{postExcerpt(row.text,170) || 'Texto não preenchido'}</p>}
      </div>;
    })}</div>
    {!rows.length && <p className="muted">Nenhum texto cadastrado nesta seção. Você pode adicionar um texto só para a postagem.</p>}
    {selected >= limit && <p className="muted post-text-count">Para escolher outro texto, desmarque ou remova um dos selecionados.</p>}
    <button type="button" className="button tonal" disabled={selected >= limit} onClick={add}><Icon name="add" />Adicionar texto em {title.toLowerCase()}</button>
  </section>;
}

export function PromotionEditor({ sources, busy, message, onGenerate, onCancel }: {
  sources: PostSources; busy: boolean; message: string; onGenerate: (selection: PostSelection) => Promise<void>; onCancel: () => void;
}) {
  const [kind, setKind] = useState<PostSectionKind>(sources.requirements.length ? 'requirements' : sources.responsibilities.length ? 'responsibilities' : 'description');
  const [groups, setGroups] = useState(() => ({
    requirements: choices(sources.requirements,'req',3), responsibilities: choices(sources.responsibilities,'resp',3),
    description: choices(sources.description ? [sources.description] : [],'desc',1), benefits: choices(sources.benefits,'benefit',4),
  }));
  const [error, setError] = useState('');
  function change(group: keyof typeof groups, rows: Choice[]) { setGroups(current => ({ ...current, [group]: rows })); setError(''); }
  function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const selection = postSelectionSchema.safeParse({ kind, items: groups[kind].filter(row => row.selected).map(row => row.text), benefits: groups.benefits.filter(row => row.selected).map(row => row.text) });
    if (!selection.success) { setError(selection.error.issues[0]?.message || 'Revise os textos selecionados.'); return; }
    void onGenerate(selection.data);
  }
  return <form className="post-content-editor" onSubmit={submit} aria-busy={busy}>
    <p className="alert info">Os primeiros destaques já estão selecionados para revisão. As alterações abaixo valem somente para esta imagem e não alteram o cadastro da vaga.</p>
    <fieldset disabled={busy} className="post-editor-fields">
      <label className="field"><span>Conteúdo principal da postagem</span><select value={kind} onChange={event => { setKind(event.target.value as PostSectionKind); setError(''); }}>
        <option value="requirements">Requisitos</option><option value="responsibilities">Responsabilidades</option><option value="description">Descrição da vaga</option>
      </select></label>
      <TextChoices title={postSections[kind].title} noun={postSections[kind].item} rows={groups[kind]} onChange={rows => change(kind,rows)} limit={postSections[kind].count} recommended={postSections[kind].length} />
      <div className="post-benefit-editor"><TextChoices title="Benefícios" noun="benefício" rows={groups.benefits} onChange={rows => change('benefits',rows)} limit={4} recommended={65} />
        <p className="muted post-text-count">Se nenhum benefício for selecionado, essa seção não aparecerá na imagem.</p>
      </div>
    </fieldset>
    {(error || message) && <p className="alert danger" role="alert">{error || message}</p>}
    <div className="post-editor-actions"><button type="button" className="button outlined" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="button primary" disabled={busy || !groups[kind].some(row => row.selected)}>{busy ? <Spinner /> : <Icon name="image" />}{busy ? 'Gerando postagem…' : 'Gerar postagem'}</button>
    </div>
  </form>;
}
