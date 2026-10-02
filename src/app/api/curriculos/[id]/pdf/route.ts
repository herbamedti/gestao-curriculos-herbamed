import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { z } from 'zod';
import { db } from '@/lib/supabase';
import { candidateDetails, entryDetails } from '@/modules/candidates/details';

export const runtime='nodejs';
const labels:Record<string,string>={experience:'EXPERIÊNCIA PROFISSIONAL',education:'FORMAÇÃO ACADÊMICA',course:'CURSOS',certification:'CERTIFICAÇÕES',language:'IDIOMAS'};

function printable(value:string,font:PDFFont) {
  return [...value].map(char=>{try{font.encodeText(char);return char;}catch{return '?';}}).join('');
}

function lines(value:string,font:PDFFont,size:number,width:number) {
  const result:string[]=[];
  for(const paragraph of value.split(/\r?\n/)) {
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next=line?`${line} ${word}`:word;
      if(font.widthOfTextAtSize(next,size)<=width){line=next;continue;}
      if(line)result.push(line);
      line='';
      for(const character of word){
        if(line&&font.widthOfTextAtSize(line+character,size)>width){result.push(line);line='';}
        line+=character;
      }
    }
    result.push(line);
  }
  return result;
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const id=z.uuid().safeParse((await params).id);
  if(!id.success)return new Response('Currículo inválido',{status:400});
  const client=await db();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return new Response('Faça login para acessar o currículo.',{status:401});
  const {error:accessError}=await client.rpc('authorize_curriculum_export',{p_candidate_id:id.data});
  if(accessError)return new Response('Currículo não encontrado.',{status:404});
  // Candidate/manager visibility is enforced by the same RLS policies as the on-screen profile.
  const [{data:person,error:profileError},{data:entries,error:entriesError}]=await Promise.all([
    client.from('candidates').select('full_name,email,phone,city,state,headline,summary,skills,professional_url,additional_info,availability,work_model').eq('id',id.data).maybeSingle(),
    client.from('profile_entries').select('kind,title,organization,start_date,end_date,description,level,status,period_text,duration_hours').eq('candidate_id',id.data).order('start_date',{ascending:false,nullsFirst:false}),
  ]);
  if(profileError||entriesError)return new Response('Não foi possível gerar o currículo.',{status:500});
  if(!person)return new Response('Currículo não encontrado.',{status:404});

  const pdf=await PDFDocument.create();
  pdf.setTitle(`Currículo - ${person.full_name}`);
  pdf.setAuthor(person.full_name);
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const green=rgb(0.02,0.43,0.22);
  const dark=rgb(0.12,0.17,0.15);
  const muted=rgb(0.37,0.42,0.39);
  let page:PDFPage=pdf.addPage([595.28,841.89]);
  let y=790;
  const pageWidth=595.28;
  const left=48;
  const width=pageWidth-left*2;
  const nextPage=()=>{page=pdf.addPage([595.28,841.89]);y=790;};
  const ensure=(height:number)=>{if(y-height<55)nextPage();};
  const write=(value:string,size=10,heavy=false,color=dark,spacing=15)=>{
    const font=heavy?bold:regular;
    const clean=printable(value,font);
    for(const line of lines(clean,font,size,width)){
      ensure(spacing);
      if(line)page.drawText(line,{x:left,y,size,font,color});
      y-=spacing;
    }
  };
  const section=(title:string)=>{ensure(42);y-=16;page.drawText(title,{x:left,y,size:10,font:bold,color:green});y-=17;page.drawLine({start:{x:left,y:y+9},end:{x:pageWidth-left,y:y+9},thickness:0.6,color:rgb(0.81,0.86,0.82)});};

  page.drawRectangle({x:0,y:825,width:pageWidth,height:17,color:green});
  write(person.full_name,22,true,green,29);
  if(person.headline)write(person.headline,12,true,dark,20);
  const contact=[person.email,person.phone,[person.city,person.state].filter(Boolean).join(' / ')].filter(Boolean).join('  |  ');
  write(contact,9,false,muted,14);
  if(person.professional_url)write(person.professional_url,9,false,muted,14);
  const details=candidateDetails(person.additional_info);
  if(details.portfolio_url)write(details.portfolio_url,9,false,muted,14);
  const extra=[details.secondary_phone&&`Telefone alternativo: ${details.secondary_phone}`,details.neighborhood&&`Bairro: ${details.neighborhood}`,details.driver_license&&`Habilitação: ${details.driver_license}`,details.travel_available&&'Disponível para viagens',details.relocation_available&&'Disponível para mudança de cidade',person.availability,person.work_model].filter(Boolean).join(' | ');
  if(extra)write(extra,9,false,muted,14);
  if(person.summary){section('RESUMO PROFISSIONAL');write(person.summary,10);}
  if(person.skills.length){section('HABILIDADES');write(person.skills.join('  ·  '),10);}
  for(const kind of ['experience','education','course','certification','language']) {
    const items=(entries||[]).filter(entry=>entry.kind===kind);
    if(!items.length)continue;
    section(labels[kind]);
    for(const item of items){
      ensure(55);
      write(item.title,11,true,dark,16);
      const period=[item.start_date,item.end_date].filter(Boolean).map(value=>value==='Atual'?'Atual':new Intl.DateTimeFormat('pt-BR',{month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`))).join(' – ');
      write([item.organization,period].filter(Boolean).join('  |  '),9,false,muted,15);
      if(entryDetails(item))write(entryDetails(item),9,false,muted,15);
      if(item.description)write(item.description,10);
      y-=8;
    }
  }
  pdf.getPages().forEach((item,index)=>item.drawText(`${index+1} / ${pdf.getPageCount()}`,{x:pageWidth-75,y:28,size:8,font:regular,color:muted}));
  const bytes=await pdf.save();
  const filename=`curriculo-${person.full_name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'candidato'}.pdf`;
  return new Response(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
