import { z } from 'zod';
import { db } from '@/lib/supabase';
import { curriculumDocument } from '@/modules/candidates/curriculum-document';
import { curriculumPdf } from '@/modules/candidates/curriculum-pdf';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response('Currículo inválido', { status: 400 });
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return new Response('Faça login para acessar o currículo.', { status: 401 });
  const { error: accessError } = await client.rpc('authorize_curriculum_export', {
    p_candidate_id: id.data,
  });
  if (accessError) return new Response('Currículo não encontrado.', { status: 404 });
  // Candidate/manager visibility is enforced by the same RLS policies as the on-screen profile.
  const [{ data: person, error: profileError }, { data: entries, error: entriesError }] =
    await Promise.all([
      client
        .from('candidates')
        .select(
          'full_name,email,phone,city,state,headline,summary,skills,professional_url,additional_info,availability,work_model',
        )
        .eq('id', id.data)
        .maybeSingle(),
      client
        .from('profile_entries')
        .select(
          'kind,title,organization,start_date,end_date,description,level,status,period_text,duration_hours',
        )
        .eq('candidate_id', id.data)
        .order('start_date', { ascending: false, nullsFirst: false }),
    ]);
  if (profileError || entriesError)
    return new Response('Não foi possível gerar o currículo.', { status: 500 });
  if (!person) return new Response('Currículo não encontrado.', { status: 404 });

  const bytes = await curriculumPdf(curriculumDocument(person, entries || []));
  const filename = `curriculo-${
    person.full_name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'candidato'
  }.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
