import 'server-only';
import { cache } from 'react';
import { session } from './session';
const permitted = cache(async (permission: string, jobId?: string, candidateId?: string, applicationId?: string) => {
  const { client } = await session();
  const result = candidateId ? await client.rpc('can_candidate', { p_candidate_id: candidateId, p_permission: permission })
    : applicationId ? await client.rpc('can_application', { p_application_id: applicationId, p_permission: permission })
      : await client.rpc('has_permission', { p_permission: permission, ...(jobId ? { p_job_id: jobId } : {}) });
  return !result.error && result.data === true;
});
// UI visibility only: every mutation and RLS policy retains its own check.
export async function StaffPermission({ permission, jobId, candidateId, applicationId, children }: { permission: string; jobId?: string; candidateId?: string; applicationId?: string; children: React.ReactNode }) {
  return await permitted(permission, jobId, candidateId, applicationId) ? children : null;
}
