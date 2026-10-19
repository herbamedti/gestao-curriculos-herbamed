import { z } from 'zod';
import { db } from '@/lib/supabase';
import { config } from '@/lib/config';
import { jobCanShare, jobPostModel, jobPostSchema } from '@/modules/jobs/post-model';
import { jobPostPng } from '@/modules/jobs/post-image';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const failure = (message: string, status: number) => Response.json({ message }, { status, headers });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return failure('Vaga inválida.', 400);
  const client = await db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return failure('Entre novamente para gerar a postagem.', 401);
  const area = await client.rpc('account_area');
  if (area.error || area.data !== 'staff') return failure('Confirme seu acesso de gestão para continuar.', 403);
  const permission = await client.rpc('has_permission', { p_permission: 'jobs.read', p_job_id: id.data });
  if (permission.error || !permission.data) return failure('Seu acesso não permite gerar esta postagem.', 403);
  const { data, error } = await client.from('jobs')
    .select('id,code,title,slug,city,state,work_model,contract_type,description,requirements,responsibilities,benefits,status,visibility,deadline')
    .eq('id', id.data).maybeSingle();
  if (error) return failure('Não foi possível consultar a vaga. Tente novamente.', 500);
  if (!data) return failure('Vaga não encontrada.', 404);
  const job = jobPostSchema.safeParse(data);
  if (!job.success) return failure('Não foi possível preparar os dados desta vaga.', 422);
  if (!jobCanShare(job.data)) return failure('A vaga precisa estar pública, publicada e dentro do prazo para compartilhar.', 409);
  try {
    const bytes = await jobPostPng(jobPostModel(job.data, config.url));
    return new Response(bytes, { headers: {
      ...headers, 'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="vaga-${job.data.code}-herbamed.png"`,
    } });
  } catch {
    log('job_post_generation_failed');
    return failure('Não foi possível gerar a imagem. Tente novamente.', 500);
  }
}
