import { z } from 'zod';

export const jobCandidateRow = z.object({
  id:z.uuid(),candidate_id:z.uuid(),stage_id:z.uuid(),stage_name:z.string(),terminal:z.boolean(),status:z.enum(['active','withdrawn','closed']),
  created_at:z.string(),updated_at:z.string(),unlinked_at:z.string().nullable(),full_name:z.string(),email:z.string(),phone:z.string().nullable(),city:z.string().nullable(),headline:z.string().nullable(),can_edit:z.boolean(),
});
export const jobCandidateList = z.object({rows:z.array(jobCandidateRow),total:z.number().int().nonnegative(),linked:z.number().int().nonnegative(),active:z.number().int().nonnegative(),unlinked:z.number().int().nonnegative()});
export const linkCandidateList = z.array(z.object({id:z.uuid(),full_name:z.string(),email:z.string(),city:z.string().nullable(),headline:z.string().nullable(),already_linked:z.boolean()}));
export const jobApplicationChange = z.object({
  job_id:z.uuid(),application_id:z.uuid(),expected_updated_at:z.iso.datetime({offset:true}),
  note:z.string().trim().min(3,'Informe um motivo com pelo menos três caracteres.').max(2000),
});
export type JobCandidateRow = z.infer<typeof jobCandidateRow>;
export type LinkCandidate = z.infer<typeof linkCandidateList>[number];
