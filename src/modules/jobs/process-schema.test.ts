import { describe, expect, it } from 'vitest';
import { questionSchema, stagesSchema } from './process-schema';

const stage = { id: '00000000-0000-4000-8000-000000000001', name: 'Inscrição', terminal: false };
describe('Configuração do processo', () => {
  it('mantém entrada aberta e IDs únicos', () => {
    expect(stagesSchema.safeParse([stage]).success).toBe(true);
    expect(stagesSchema.safeParse([stage, stage]).success).toBe(false);
    expect(stagesSchema.safeParse([{ ...stage, terminal: true }]).success).toBe(false);
    expect(stagesSchema.safeParse([]).success).toBe(false);
  });
  it('valida alternativas e diferencia texto livre', () => {
    const question = { label: 'Disponibilidade?', required: true, kind: 'choice', options: ['Manhã', 'Tarde'] };
    expect(questionSchema.safeParse(question).success).toBe(true);
    expect(questionSchema.safeParse({ ...question, options: ['Manhã'] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, options: ['Manhã', ' Manhã '] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, kind: 'text' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, kind: 'text', options: [] }).success).toBe(true);
  });
});
