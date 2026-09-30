export type CurriculumProfile = { full_name:string;email:string;phone:string;city:string;headline:string;summary:string;skills:string[] };
export type CurriculumEntry = { kind:string;title:string;organization:string };
export const curriculumFields = [
  { key:'full_name',label:'Nome completo',step:'dados' },
  { key:'email',label:'E-mail',step:'dados' },
  { key:'phone',label:'Telefone com DDD',step:'dados' },
  { key:'city',label:'Cidade',step:'dados' },
  { key:'headline',label:'Área de atuação',step:'dados' },
  { key:'summary',label:'Resumo profissional com pelo menos 30 caracteres',step:'dados' },
  { key:'skills',label:'Ao menos uma habilidade',step:'dados' },
  { key:'trajectory',label:'Ao menos uma experiência ou formação com instituição',step:'trajetoria' },
] as const;
export type CurriculumField=(typeof curriculumFields)[number]['key'];
export function curriculumMissing(profile:CurriculumProfile|null,entries:CurriculumEntry[]):CurriculumField[] {
  return curriculumFields.filter(({key})=>{
    if(!profile)return true;
    switch(key){
      case 'full_name':return profile.full_name.trim().length<2;
      case 'email':return !profile.email.trim();
      case 'phone':return profile.phone.replace(/\D/g,'').length<10;
      case 'city':return profile.city.trim().length<2;
      case 'headline':return profile.headline.trim().length<3;
      case 'summary':return profile.summary.trim().length<30;
      case 'skills':return profile.skills.length===0;
      case 'trajectory':return !entries.some(e=>['experience','education'].includes(e.kind)&&e.title.trim().length>=2&&e.organization.trim().length>=2);
    }
  }).map(({key})=>key);
}
export function profileCompletion(profile:CurriculumProfile|null,entries:CurriculumEntry[]) {
  return Math.round((curriculumFields.length-curriculumMissing(profile,entries).length)/curriculumFields.length*100);
}
