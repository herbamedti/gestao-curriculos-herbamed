import { describe, expect, it } from 'vitest';
import { candidateDetailsSchema, entrySchema } from './details';
import { jobItems } from '../jobs/items';
const entry={kind:'language',title:'Inglês',organization:'',description:'',start_date:'',end_date:'',duration_hours:''};
describe('Informações complementares do currículo',()=>{
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
