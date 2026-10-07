import { z } from 'zod';

export const stageSchema = z.object({ id: z.uuid(), name: z.string().trim().min(2).max(100), terminal: z.boolean() });
export const stagesSchema = z.array(stageSchema).min(1).max(50).refine(items => new Set(items.map(item => item.id)).size === items.length, 'Etapas duplicadas.').refine(items => !items[0]?.terminal, 'A primeira etapa deve receber inscrições e não pode ser final.');
export const questionSchema = z.object({
  label: z.string().trim().min(2).max(500),
  required: z.boolean(),
  kind: z.enum(['text', 'choice']),
  options: z.array(z.string().trim().min(1).max(200)).max(30),
}).superRefine((value, ctx) => {
  if (value.kind === 'choice' && (value.options.length < 2 || new Set(value.options).size !== value.options.length)) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Adicione pelo menos duas opções distintas.' });
  if (value.kind === 'text' && value.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Perguntas de texto não possuem opções.' });
});
