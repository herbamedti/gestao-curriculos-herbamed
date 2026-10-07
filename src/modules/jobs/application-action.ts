'use server';
import { redirect } from 'next/navigation';
import { mutate } from '@/modules/actions';
import type { ActionResult } from '@/lib/result';

export async function applyToJob(state: ActionResult, form: FormData): Promise<ActionResult> {
  form.set('op', 'apply');
  const result = await mutate(state, form);
  // The refreshed application page removes its form after persistence. Perform
  // navigation on the server, independently of that form's client-side effect.
  if (result.ok) redirect('/candidato/candidaturas');
  return result;
}
