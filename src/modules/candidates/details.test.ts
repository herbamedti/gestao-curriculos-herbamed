import { describe, expect, it } from 'vitest';
import { candidateDetailsSchema, entrySchema, initialEntriesSchema, entryPeriod } from './details';
import { jobItems } from '../jobs/items';
const entry={kind:'language',title:'Inglês',organization:'',description:'',start_date:'',end_date:'',duration_hours:''};
describe('Informações complementares do currículo',()=>{
  it('exibe datas completas sem deslocamento de dia pelo fuso horário',()=>{
    expect(entryPeriod({start_date:'2026-01-01',end_date:'2026-03-30'})).toBe('01/01/2026 – 30/03/2026');
    expect(entryPeriod({start_date:null,end_date:null})).toBe('');
    expect(entryPeriod({start_date:'2026-01-01'})).toBe('01/01/2026');
  });
  it('valida competências pessoais e preserva currículos sem o campo',()=>{
    expect(candidateDetailsSchema.parse({}).personal_competencies).toEqual([]);
    expect(candidateDetailsSchema.parse({personal_competencies:[' Trabalho em equipe ']}).personal_competencies).toEqual(['Trabalho em equipe']);
    expect(candidateDetailsSchema.safeParse({personal_competencies:['']}).success).toBe(false);
    expect(candidateDetailsSchema.safeParse({personal_competencies:Array(31).fill('Teste')}).success).toBe(false);
  });
  it('valida os itens do cadastro inicial, incluindo horas opcionais nulas',()=>{
    expect(initialEntriesSchema.parse([{...entry,duration_hours:null}])[0].duration_hours).toBeNull();
    expect(initialEntriesSchema.safeParse([{...entry,kind:'education',organization:''}]).success).toBe(false);
    expect(initialEntriesSchema.safeParse(Array(51).fill(entry)).success).toBe(false);
  });
  it('permite idioma sem instituição e registra nível',()=>{
    expect(entrySchema.parse({...entry,level:'Intermediário'}).level).toBe('Intermediário');
    expect(entrySchema.safeParse({...entry,kind:'education'}).success).toBe(false);
  });
  it('rejeita datas invertidas e formação em andamento com fim',()=>{
    expect(entrySchema.safeParse({...entry,start_date:'2026-10-01',end_date:'2026-09-01'}).success).toBe(false);
    expect(entrySchema.safeParse({...entry,status:'Em andamento',end_date:'2026-10-01'}).success).toBe(false);
  });
  it('valida habilitação e link profissional',()=>{
    expect(candidateDetailsSchema.safeParse({driver_license:'ZZ'}).success).toBe(false);
    expect(candidateDetailsSchema.safeParse({portfolio_url:'javascript:alert(1)'}).success).toBe(false);
    expect(candidateDetailsSchema.parse({driver_license:'AB',travel_available:true}).travel_available).toBe(true);
  });
  it('preserva conteúdo das vagas antigas e transforma linhas em itens',()=>{
    expect(jobItems('Desenvolver sistemas;\n- Auxiliar usuários;')).toEqual(['Desenvolver sistemas;','Auxiliar usuários;']);
    expect(jobItems('Texto legado completo. Outra frase.')).toEqual(['Texto legado completo. Outra frase.']);
  });
});
