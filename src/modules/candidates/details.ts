import { z } from 'zod';

const httpsUrl = z.union([z.literal(''), z.url().max(500).refine(value => value.startsWith('https://'))]);
export const candidateDetailsSchema = z.object({
  secondary_phone: z.string().trim().max(30).default(''),
  neighborhood: z.string().trim().max(100).default(''),
  driver_license: z.enum(['', 'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE']).default(''),
  portfolio_url: httpsUrl.default(''),
  travel_available: z.boolean().default(false),
  relocation_available: z.boolean().default(false),
});
export function candidateDetails(value: unknown) {
  const parsed = candidateDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : candidateDetailsSchema.parse({});
}
export const entryKinds: Record<string, string> = { experience: 'Experiência profissional', education: 'Formação acadêmica', course: 'Curso', certification: 'Certificação', language: 'Idioma' };
export const entrySchema = z.object({
  kind: z.enum(['experience', 'education', 'course', 'certification', 'language']),
  title: z.string().trim().min(2).max(160),
  organization: z.string().trim().max(160),
  start_date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/), end_date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(10000),
  level: z.string().trim().max(100).default(''),
  status: z.enum(['', 'Atual', 'Em andamento', 'Concluído', 'Interrompido']).default(''),
  period_text: z.string().trim().max(100).default(''),
  duration_hours: z.union([z.literal(''), z.coerce.number().int().positive().max(100000)]).transform(value => value === '' ? null : value),
}).refine(value => value.kind === 'language' || value.organization.length >= 2, { path: ['organization'], message: 'Informe a empresa ou instituição.' })
  .refine(value => !value.start_date || !value.end_date || value.end_date >= value.start_date, { path: ['end_date'], message: 'O fim deve ser posterior ao início.' })
  .refine(value => !['Atual', 'Em andamento'].includes(value.status) || !value.end_date, { path: ['end_date'], message: 'Um item em andamento não deve ter data de fim.' });

export function entryDetails(entry: { level?: string; status?: string; period_text?: string; duration_hours?: number | null }) {
  return [entry.level, entry.status, entry.period_text, entry.duration_hours ? `${entry.duration_hours} horas` : ''].filter(Boolean).join(' · ');
}
