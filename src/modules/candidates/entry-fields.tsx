'use client';
import { useState } from 'react';
import type { Database } from '@/lib/database.types';
import { Field, Select } from '@/ui/form';
import { EditableList } from '@/ui/editable-list';
import { textListItems } from '@/ui/list-items';
import { entryKinds, type EntryKind } from './details';
type Entry = Database['public']['Tables']['profile_entries']['Row'];
export function EntryFields({ entry, fixedKind, prefix = '', draft = false }: { entry?: Entry; fixedKind?: EntryKind; prefix?: string; draft?: boolean }) {
  const [kind, setKind] = useState(fixedKind || entry?.kind || 'experience');
  const name = (field: string) => `${prefix}${field}`;
  return <>
    {fixedKind ? <input type="hidden" name={name('kind')} value={fixedKind} /> : <label className="field"><span>Tipo</span><select name={name('kind')} value={kind} onChange={event => setKind(event.target.value)}>{Object.entries(entryKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    <Field name={name('title')} label={kind === 'language' ? 'Idioma' : kind === 'experience' ? 'Cargo' : kind === 'education' ? 'Curso ou formação' : 'Nome do curso ou certificado'} value={entry?.title} required={!draft} maxLength={160} />
    <Field name={name('organization')} label={kind === 'language' ? 'Instituição de ensino (opcional)' : 'Empresa ou instituição'} value={entry?.organization} required={!draft && kind !== 'language'} maxLength={160} />
    <div className="form-grid">
      {kind === 'language' ? <Select name={name('level')} label="Nível do idioma" value={entry?.level || ''}><option value="">Não informado</option>{['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo'].map(level => <option key={level}>{level}</option>)}</Select> : <Field name={name('level')} label={kind === 'education' ? 'Nível / semestre (opcional)' : 'Nível ou especialização (opcional)'} value={entry?.level} maxLength={100} placeholder={kind === 'education' ? 'Ex.: Técnico, Superior, 3º semestre' : 'Ex.: Básico, Intermediário'} />}
      <Select name={name('status')} label="Situação" value={entry?.status || ''}><option value="">Não informado</option>{['Atual', 'Em andamento', 'Concluído', 'Interrompido'].map(status => <option key={status}>{status}</option>)}</Select>
      <Field name={name('start_date')} label="Início (se conhecido)" type="date" value={entry?.start_date || ''} />
      <Field name={name('end_date')} label="Fim (vazio se em andamento)" type="date" value={entry?.end_date || ''} />
      <Field name={name('period_text')} label="Período ou duração (opcional)" value={entry?.period_text} maxLength={100} placeholder="Ex.: 6 anos, conclusão prevista em 2027" />
      <Field name={name('duration_hours')} label="Carga horária (horas, opcional)" type="number" value={entry?.duration_hours ?? ''} min={1} max={100000} />
    </div>
    <EditableList name={name('description')} label={kind === 'experience' ? 'Atividades e resultados' : kind === 'education' ? 'Conteúdos e detalhes da formação' : kind === 'course' ? 'Conteúdos do curso' : kind === 'certification' ? 'Conhecimentos e detalhes do certificado' : 'Uso do idioma e detalhes (opcional)'} initial={textListItems(entry?.description || '')} maxItems={50} maxLength={10000} bulk resetOnFormReset={!entry} />
  </>;
}
