'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { session } from '@/modules/auth/session';
import { safeError, type ActionResult } from '@/lib/result';
import { jobApplicationChange, linkCandidateList, type LinkCandidate } from './candidate-management-schema';
import { log } from '@/lib/logger';

export async function manageJobCandidate(_:ActionResult,form:FormData):Promise<ActionResult> {
  const {client}=await session();
  try {
    const op=z.enum(['link','unlink','edit']).parse(form.get('op'));
    const jobId=z.uuid().parse(form.get('job_id'));
    let result;
    if(op==='link') {
      const candidateId=z.uuid().parse(form.get('candidate_id'));
      const note=jobApplicationChange.shape.note.parse(form.get('note'));
      result=await client.rpc('link_candidate_to_job',{p_candidate_id:candidateId,p_job_id:jobId,p_note:note});
    } else {
      const data=jobApplicationChange.parse(Object.fromEntries(form));
      result=op==='unlink'
        ? await client.rpc('unlink_job_candidate',{p_job_id:jobId,p_application_id:data.application_id,p_expected_updated_at:data.expected_updated_at,p_note:data.note})
        : await client.rpc('update_job_application',{p_job_id:jobId,p_application_id:data.application_id,p_expected_updated_at:data.expected_updated_at,p_note:data.note,
          p_stage_id:z.uuid().parse(form.get('stage_id')),p_status:z.enum(['active','closed']).parse(form.get('status'))});
    }
    if(result.error)return safeError(result.error.code,result.error.message);
    revalidatePath('/rh','layout');revalidatePath('/candidato','layout');
    return {ok:true,message:op==='link'?'Candidato vinculado à vaga.':op==='unlink'?'Candidato desvinculado. Currículo e histórico preservados.':'Candidatura atualizada.'};
  } catch(error) {
    if(error instanceof z.ZodError)return {ok:false,message:error.issues[0]?.message||'Confira os campos informados.'};
    log('job_candidate_management_failed');return safeError();
  }
}
export type CandidateSearchState={rows:LinkCandidate[];message:string;searched:boolean};
export async function searchJobCandidate(_:CandidateSearchState,form:FormData):Promise<CandidateSearchState> {
  const {client}=await session();
  try {
    const jobId=z.uuid().parse(form.get('job_id'));
    const search=z.string().trim().min(2).max(100).parse(form.get('search'));
    const result=await client.rpc('search_job_candidate_links',{p_job_id:jobId,p_search:search});
    const parsed=linkCandidateList.safeParse(result.data);
    if(result.error||!parsed.success)return {rows:[],searched:false,message:'Não foi possível consultar os candidatos. Confira seu acesso e tente novamente.'};
    return {rows:parsed.data,searched:true,message:parsed.data.length?'':'Nenhum currículo disponível encontrado. Revise a busca ou cadastre um candidato.'};
  } catch {return {rows:[],searched:false,message:'Digite de 2 a 100 caracteres para buscar por nome ou e-mail.'};}
}
