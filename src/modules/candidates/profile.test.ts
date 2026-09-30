import { describe, expect, it } from 'vitest';
import { curriculumMissing, profileCompletion } from './profile';
const candidate={full_name:'Joana de Teste',email:'joana@example.test',phone:'(47) 99999-9999',city:'Joinville',headline:'Analista de qualidade',summary:'Atuação em qualidade, processos e melhoria contínua.',skills:['Qualidade']};
describe('currículo estruturado',()=>{
  it('aceita formação para quem ainda não tem experiência profissional',()=>{
    const entries=[{kind:'education',title:'Graduação em Farmácia',organization:'Instituição Exemplo'}];
    expect(curriculumMissing(candidate,entries)).toEqual([]);
    expect(profileCompletion(candidate,entries)).toBe(100);
  });
  it('solicita contato, resumo e trajetória quando faltam dados essenciais',()=>{
    expect(curriculumMissing({...candidate,phone:'',summary:'Curto'},[])).toEqual(['phone','summary','trajectory']);
  });
});
