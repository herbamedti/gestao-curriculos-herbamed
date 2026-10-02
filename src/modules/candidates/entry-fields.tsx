'use client';
import { useState } from 'react';
import type { Database } from '@/lib/database.types';
import { Field, TextArea, Select } from '@/ui/form';
import { entryKinds } from './details';
type Entry = Database['public']['Tables']['profile_entries']['Row'];
export function EntryFields({ entry }: { entry?: Entry }) {
  const [kind, setKind] = useState(entry?.kind || 'experience');
  return <>
    <label className="field"><span>Tipo</span><select name="kind" value={kind} onChange={event => setKind(event.target.value)}>{Object.entries(entryKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <Field name="title" label={kind === 'language' ? 'Idioma' : 'Cargo, curso ou título'} value={entry?.title} required maxLength={160} />
    <Field name="organization" label={kind === 'language' ? 'Instituição de ensino (opcional)' : 'Empresa ou instituição'} value={entry?.organization} required={kind !== 'language'} maxLength={160} />
    <div className="form-grid">
      {kind === 'language' ? <Select name="level" label="Nível do idioma" value={entry?.level || ''}><option value="">Não informado</option>{['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo'].map(level => <option key={level}>{level}</option>)}</Select> : <Field name="level" label={kind === 'education' ? 'Nível / semestre (opcional)' : 'Nível ou especialização (opcional)'} value={entry?.level} maxLength={100} placeholder={kind === 'education' ? 'Ex.: Técnico, Superior, 3º semestre' : 'Ex.: Básico, Intermediário'} />}
      <Select name="status" label="Situação" value={entry?.status || ''}><option value="">Não informado</option>{['Atual', 'Em andamento', 'Concluído', 'Interrompido'].map(status => <option key={status}>{status}</option>)}</Select>
      <Field name="start_date" label="Início (se conhecido)" type="date" value={entry?.start_date || ''} />
      <Field name="end_date" label="Fim (vazio se em andamento)" type="date" value={entry?.end_date || ''} />
      <Field name="period_text" label="Período ou duração (opcional)" value={entry?.period_text} maxLength={100} placeholder="Ex.: 6 anos, conclusão prevista em 2027" />
      <Field name="duration_hours" label="Carga horária (horas, opcional)" type="number" value={entry?.duration_hours ?? ''} min={1} max={100000} />
    </div>
    <TextArea name="description" label="Atividades, resultados ou detalhes" value={entry?.description} />
  </>;
}
