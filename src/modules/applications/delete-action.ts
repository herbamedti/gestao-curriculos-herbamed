'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/modules/auth/session';
import { safeError, type ActionResult } from '@/lib/result';
import { log } from '@/lib/logger';

const deletion = z.object({
  application_id: z.uuid(),
  expected_updated_at: z.iso.datetime({ offset: true }),
  confirmation: z.literal('EXCLUIR', { error: 'Digite EXCLUIR para confirmar a exclusão.' }),
});

export async function deleteApplication(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { client } = await requireStaff();
  const allowed = await client.rpc('is_primary_administrator');
  if (allowed.error || !allowed.data) return { ok: false, message: 'Somente o administrador geral, com duas etapas confirmadas, pode excluir candidaturas.' };
  try {
    const input = deletion.safeParse(Object.fromEntries(form));
    if (!input.success) return { ok: false, message: 'Confira a confirmação e atualize a página antes de tentar novamente.' };
    const result = await client.rpc('delete_application', {
      p_application_id: input.data.application_id, p_expected_updated_at: input.data.expected_updated_at,
    });
    if (result.error) return safeError(result.error.code, result.error.message);
  } catch {
    log('application_delete_failed');
    return safeError();
  }
  revalidatePath('/rh', 'layout');
  revalidatePath('/candidato', 'layout');
  // The deleted row can unmount the form during revalidation. Navigation must
  // happen on the server, independently of the form's client-side effects.
  redirect('/rh/candidaturas?excluida=1');
}
