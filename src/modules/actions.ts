'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { session } from '@/modules/auth/session';
import { safeError, type ActionResult } from '@/lib/result';
import { log } from '@/lib/logger';
import { candidateDetailsSchema, entrySchema, initialEntriesSchema } from '@/modules/candidates/details';
import { questionSchema, stageSchema, stagesSchema } from '@/modules/jobs/process-schema';
import { policySchema } from '@/modules/privacy/policy-schema';
const uuid=z.uuid();
const text=z.string().trim().min(1).max(10000);
const optional=z.string().max(10000);
export async function mutate(_:ActionResult,form:FormData):Promise<ActionResult> {
  const {client}=await session();
  let publishedPolicyRedirect:string|undefined;
  const get=(key:string)=>form.get(key)??'';
  const id=(key:string)=>uuid.parse(get(key));
  const str=(key:string)=>text.parse(get(key));
  const opt=(key:string)=>optional.parse(get(key));
  const flag=(key:string)=>get(key)==='on'||get(key)==='true';
  const details=()=>candidateDetailsSchema.parse({secondary_phone:opt('secondary_phone'),neighborhood:opt('neighborhood'),driver_license:opt('driver_license'),portfolio_url:opt('portfolio_url'),travel_available:flag('travel_available'),relocation_available:flag('relocation_available'),personal_competencies:JSON.parse(opt('personal_competencies')||'[]')});
  const initialEntries=()=>initialEntriesSchema.parse(JSON.parse(z.string().max(600000).parse(get('initial_entries'))||'[]'));
  const skills=()=>z.array(z.string().trim().min(1).max(100)).max(30).parse(JSON.parse(opt('skills')||'[]'));
  const staffCurriculum=()=>{
    const data=z.object({full_name:z.string().trim().min(2).max(160),email:z.email(),phone:z.string().max(30),city:z.string().max(100),state:z.string().max(2),headline:z.string().max(160),summary:z.string().max(4000),professional_url:z.union([z.literal(''),z.url().refine(value=>value.startsWith('https://'))]),availability:z.string().max(100),work_model:z.string().max(30),source:z.string().trim().min(3).max(100),processing_purpose:z.string().trim().min(3).max(200),legal_basis:z.string().trim().max(200)}).parse(Object.fromEntries(form));
    return {...data,additional_info:details(),skills:skills(),interests:z.array(uuid).max(10).parse(form.getAll('interests'))};
  };
  try {
    const op=str('op');
    let result: {error:{code?:string;message:string}|null;data?:unknown};
    let destination:string|undefined;
    switch(op) {
      case 'profile': {
        const parsed=z.object({full_name:z.string().min(2).max(160),email:z.string().optional(),phone:z.string().max(30),city:z.string().max(100),state:z.string().max(2),headline:z.string().max(160),summary:z.string().max(4000),professional_url:z.union([z.literal(''),z.url().refine(u=>u.startsWith('https://'))])}).parse(Object.fromEntries(form));
        result=await client.rpc('save_candidate',{p_data:{...parsed,additional_info:details(),skills:skills(),initial_entries:initialEntries(),availability:opt('availability'),work_model:opt('work_model'),interests:z.array(uuid).max(10).parse(form.getAll('interests'))},...(get('candidate_id')?{p_candidate_id:id('candidate_id')}:{})});
        break;
      }
      case 'manual-candidate': {
        result=await client.rpc('create_manual_candidate',{p_data:{...staffCurriculum(),initial_entries:initialEntries()}});
        if(result.data) destination=`/rh/candidatos/${result.data}`;
        break;
      }
      case 'staff-curriculum':result=await client.rpc('manage_candidate_curriculum',{p_candidate_id:id('candidate_id'),p_data:staffCurriculum()});break;
      case 'link-candidate': {
        result=await client.rpc('link_candidate_to_job',{p_candidate_id:id('candidate_id'),p_job_id:id('job_id'),p_note:z.string().trim().min(3).max(2000).parse(get('note'))});
        if(result.data)destination=`/rh/candidaturas/${result.data}`;
        break;
      }
      case 'entry':
      case 'edit-entry': {
        const data=entrySchema.parse({...Object.fromEntries(form),duration_hours:get('duration_hours')});
        result=op==='entry'?await client.rpc('save_profile_entry',{p_candidate_id:id('candidate_id'),p_data:data}):await client.rpc('update_profile_entry',{p_candidate_id:id('candidate_id'),p_entry_id:id('entry_id'),p_data:data});
        break;
      }
      case 'delete-entry': result=await client.rpc('save_profile_entry',{p_candidate_id:id('candidate_id'),p_entry_id:id('entry_id'),p_data:{}});break;
      case 'privacy-consent': result=await client.rpc('save_privacy',{p_policy_id:id('policy_id'),p_talent_pool:flag('talent_pool')});break;
      case 'privacy-policy': {
        if(!flag('approved'))return {ok:false,message:'Confirme a aprovação do aviso antes de publicá-lo.'};
        const parsed=policySchema.safeParse({version:get('version'),title:get('title'),body:get('body')});
        if(!parsed.success)return {ok:false,message:parsed.error.issues[0].message};
        result=await client.rpc('publish_privacy_policy',{
          p_version:parsed.data.version,
          p_title:parsed.data.title,
          p_body:parsed.data.body,
        });
        if(result.error?.code==='23505')return safeError(undefined,'policy_version_exists');
        if(result.data)publishedPolicyRedirect=`/rh/privacidade?aviso=${result.data}&publicado=1`;
        break;
      }
      case 'privacy-request': result=await client.rpc('request_privacy',{p_kind:z.enum(['access','correction','deletion','portability','revocation','information']).parse(get('kind')),p_detail:opt('detail')});break;
      case 'resolve-privacy': result=await client.rpc('resolve_privacy',{p_id:id('id'),p_status:z.enum(['reviewing','completed','denied']).parse(get('status')),p_resolution:str('resolution')});break;
      case 'job': {
        const data=z.object({title:z.string().min(3).max(160),city:z.string().min(2).max(100),state:z.string().max(2),work_model:z.enum(['Presencial','Híbrido','Remoto']),contract_type:z.string().min(2).max(50),description:z.string().min(20).max(10000),requirements:z.string().max(10000),responsibilities:z.string().max(10000),benefits:z.string().max(10000),department_id:z.union([uuid,z.literal('')]),openings:z.coerce.number().int().min(1).max(1000),deadline:z.string()}).parse(Object.fromEntries(form));
        const slug=data.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+crypto.randomUUID().slice(0,8);
        const catalogs=z.object({experience_level_id:z.union([uuid,z.literal('')]),employment_type_id:z.union([uuid,z.literal('')])}).parse(Object.fromEntries(form));
        result=await client.rpc('save_job',{p_data:{...data,...catalogs,deadline:data.deadline?new Date(`${data.deadline}T23:59:59-03:00`).toISOString():'',slug},...(get('job_id')?{p_job_id:id('job_id')}:{})});
        if(result.data) destination=`/rh/vagas/${result.data}`;
        break;
      }
      case 'job-status': result=await client.rpc('set_job_status',{p_job_id:id('job_id'),p_status:z.enum(['draft','pending','published','paused','closed','cancelled','archived']).parse(get('status'))});break;
      case 'job-item': result=await client.rpc('add_job_item',{p_job_id:id('job_id'),p_kind:z.enum(['stage','question']).parse(get('kind')),p_label:str('label'),p_required:flag('required')});break;
      case 'job-stages': result=await client.rpc('save_job_stages',{p_job_id:id('job_id'),p_stages:stagesSchema.parse(JSON.parse(z.string().max(30000).parse(get('stages')))),p_expected:z.array(stageSchema).max(50).parse(JSON.parse(z.string().max(30000).parse(get('expected_stages'))))});break;
      case 'job-question': {
        const kind=z.enum(['text','choice']).parse(get('kind'));
        const data=questionSchema.parse({label:get('label'),required:flag('required'),kind,options:kind==='choice'?opt('options').split('\n').map(value=>value.trim()).filter(Boolean):[]});
        result=await client.rpc('save_job_question',{p_job_id:id('job_id'),p_data:data,...(get('question_id')?{p_question_id:id('question_id')}:{})});break;
      }
      case 'delete-job-question': result=await client.rpc('delete_job_question',{p_job_id:id('job_id'),p_question_id:id('question_id')});break;
      case 'apply': {
        if(!flag('acknowledge')) return {ok:false,message:'Revise o aviso de privacidade antes de enviar.'};
        const answers:Record<string,string>={};
        for(const [key,value] of form.entries()) if(key.startsWith('answer_')) answers[uuid.parse(key.slice(7))]=z.string().max(4000).parse(value);
        result=await client.rpc('submit_application',{p_job_id:id('job_id'),p_policy_id:id('policy_id'),p_answers:answers});
        destination='/candidato/candidaturas';break;
      }
      case 'move': result=await client.rpc('move_application',{p_application_id:id('application_id'),p_stage_id:id('stage_id'),p_expected_stage:id('expected_stage'),p_note:opt('note')});break;
      case 'withdraw': result=await client.rpc('withdraw_application',{p_application_id:id('application_id')});break;
      case 'evaluation': result=await client.rpc('add_evaluation',{p_application_id:id('application_id'),p_kind:z.enum(['note','evaluation']).parse(get('kind')),p_body:str('body'),p_criteria:opt('criteria'),p_recommendation:opt('recommendation')});break;
      case 'interview': result=await client.rpc('schedule_interview',{p_application_id:id('application_id'),p_starts_at:new Date(`${str('starts_at')}:00-03:00`).toISOString(),p_location:str('location'),p_duration:z.coerce.number().int().min(10).max(480).parse(get('duration'))});break;
      case 'message': result=await client.rpc('send_message',{p_candidate_id:id('candidate_id'),p_subject:str('subject'),p_body:str('body')});break;
      case 'notification': result=await client.rpc('mark_notification',{p_id:id('id')});break;
      case 'catalog': result=await client.rpc('manage_catalog',{p_catalog:z.enum(['departments','interest_areas','tags','talent_pools','experience_levels','employment_types']).parse(get('catalog')),p_name:z.string().trim().min(2).max(100).parse(get('name')),p_active:flag('active'),...(get('id')?{p_id:id('id')}:{})});break;
      case 'delete-catalog': result=await client.rpc('delete_catalog',{p_catalog:z.enum(['departments','interest_areas','tags','talent_pools','experience_levels','employment_types']).parse(get('catalog')),p_id:id('id')});break;
      case 'role': result=await client.rpc('manage_role',{p_name:str('name'),p_scope:z.enum(['all','assigned']).parse(get('scope')),p_mfa:flag('mfa'),p_permissions:z.array(z.string().max(80)).max(100).parse(form.getAll('permissions')),...(get('id')?{p_id:id('id')}:{})});break;
      case 'staff': result=await client.rpc('manage_staff',{p_email:z.email().parse(get('email')),p_name:str('name'),p_role_id:id('role_id'),p_active:flag('active')});break;
      case 'setting': {
        const key=z.enum(['app_name','max_interest_areas','retention']).parse(get('key'));
        const value=key==='max_interest_areas'?z.coerce.number().int().min(1).max(10).parse(get('value')):key==='retention'?z.object({approved:z.boolean(),talent_days:z.number().int().positive().nullable(),document_days:z.number().int().positive().nullable(),audit_days:z.number().int().positive().nullable()}).parse(JSON.parse(str('value'))):str('value');
        result=await client.rpc('update_setting',{p_key:key,p_value:value});break;
      }
      default:return {ok:false,message:'Operação não reconhecida.'};
    }
    if(result.error) { log('mutation_rejected',{code:result.error.code}); return safeError(result.error.code,result.error.message); }
    revalidatePath('/','layout');
    if(!publishedPolicyRedirect)return {ok:true,message:'Alterações salvas com sucesso.',...(destination?{redirect:destination}:{})};
  } catch(error) {
    if(error instanceof z.ZodError) {
      if(get('op')==='job-stages')return safeError(undefined,error.issues.some(issue=>issue.message.includes('primeira etapa'))?'initial_stage_final':'invalid_stages');
      if(get('op')==='job-question')return safeError(undefined,'invalid_question');
      return {ok:false,message:`Verifique o campo ${String(error.issues[0]?.path[0] || 'informado')}. Os dados não foram salvos.`};
    }
    log('mutation_failed');return safeError();
  }
  // Publishing remounts the editor with the new active record. Navigate before
  // its previous action state disappears; redirect must stay outside the catch.
  redirect(publishedPolicyRedirect);
}
