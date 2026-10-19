import { z } from 'zod';

export const postSections = {
  requirements: { title: 'Requisitos', item: 'requisito', count: 3, length: 110 },
  responsibilities: { title: 'Responsabilidades', item: 'responsabilidade', count: 3, length: 110 },
  description: { title: 'Sobre a vaga', item: 'descrição', count: 1, length: 250 },
} as const;
export type PostSectionKind = keyof typeof postSections;
const text = z.string().trim().min(1, 'Preencha ou remova os textos vazios.').max(10000, 'Cada texto aceita até 10.000 caracteres.');
export const postSelectionSchema = z.object({
  kind: z.enum(['requirements', 'responsibilities', 'description']),
  items: z.array(text).min(1, 'Selecione ao menos um texto principal.').max(3, 'Selecione até três destaques principais.'),
  benefits: z.array(text).max(4, 'Selecione até quatro benefícios.'),
}).strict().superRefine((value, context) => {
  if (value.items.length > postSections[value.kind].count)
    context.addIssue({ code: 'custom', path: ['items'], message: 'A descrição aceita apenas um texto.' });
});
export type PostSelection = z.infer<typeof postSelectionSchema>;
export type PostSources = { requirements: string[]; responsibilities: string[]; benefits: string[]; description: string };
