import type { Database } from '@/lib/database.types';
import { textListItems } from '@/ui/list-items';
import { candidateDetails, entryPeriod, type EntryKind } from './details';

export type CurriculumPerson = Pick<
  Database['public']['Tables']['candidates']['Row'],
  | 'full_name'
  | 'headline'
  | 'email'
  | 'phone'
  | 'city'
  | 'state'
  | 'summary'
  | 'skills'
  | 'professional_url'
  | 'additional_info'
  | 'availability'
  | 'work_model'
>;
export type CurriculumEntry = Pick<
  Database['public']['Tables']['profile_entries']['Row'],
  | 'kind'
  | 'title'
  | 'organization'
  | 'start_date'
  | 'end_date'
  | 'description'
  | 'level'
  | 'status'
  | 'period_text'
  | 'duration_hours'
>;

const sections: { kind: EntryKind; label: string }[] = [
  { kind: 'experience', label: 'Experiência profissional' },
  { kind: 'education', label: 'Formação acadêmica' },
  { kind: 'course', label: 'Cursos e aperfeiçoamento' },
  { kind: 'certification', label: 'Certificações' },
  { kind: 'language', label: 'Idiomas' },
];

function phoneLabel(value: string) {
  let digits = value.replace(/\D/g, '');
  const country = digits.length === 13 && digits.startsWith('55') ? '+55 ' : '';
  if (country) digits = digits.slice(2);
  if (digits.length === 11)
    return `${country}(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

export function curriculumDocument(person: CurriculumPerson, entries: CurriculumEntry[]) {
  const details = candidateDetails(person.additional_info);
  return {
    name: person.full_name,
    headline: person.headline,
    location: [person.city, person.state].filter(Boolean).join(' / '),
    contacts: [
      person.email,
      person.phone && phoneLabel(person.phone),
      details.secondary_phone && `Alternativo: ${phoneLabel(details.secondary_phone)}`,
    ].filter(Boolean),
    links: [
      { label: 'LinkedIn', url: person.professional_url },
      { label: 'Portfólio / site', url: details.portfolio_url },
    ].filter((link) => Boolean(link.url)),
    summary: person.summary,
    skills: person.skills,
    competencies: details.personal_competencies,
    information: [
      details.neighborhood && `Bairro: ${details.neighborhood}`,
      details.driver_license && `Habilitação: ${details.driver_license}`,
      person.availability && `Disponibilidade: ${person.availability}`,
      person.work_model && `Modelo de trabalho: ${person.work_model}`,
      details.travel_available && 'Disponibilidade para viagens',
      details.relocation_available && 'Disponibilidade para mudança de cidade',
    ].filter((value): value is string => typeof value === 'string' && Boolean(value)),
    sections: sections
      .map((section) => ({
        ...section,
        entries: entries
          .filter((entry) => entry.kind === section.kind)
          .map((entry) => {
            let period = entryPeriod(entry);
            if (
              entry.start_date &&
              !entry.end_date &&
              ['Atual', 'Em andamento'].includes(entry.status)
            )
              period += ' – Atual';
            if (!entry.start_date && entry.end_date) period = `Até ${period}`;
            return {
              title: entry.title,
              organization: entry.organization,
              period: period || entry.period_text,
              metadata: [
                entry.level,
                entry.status,
                period && entry.period_text,
                entry.duration_hours &&
                  `Carga horária: ${entry.duration_hours} ${entry.duration_hours === 1 ? 'hora' : 'horas'}`,
              ]
                .filter(Boolean)
                .join(' · '),
              bullets: textListItems(entry.description),
            };
          }),
      }))
      .filter((section) => section.entries.length > 0),
  };
}

export type CurriculumDocument = ReturnType<typeof curriculumDocument>;
