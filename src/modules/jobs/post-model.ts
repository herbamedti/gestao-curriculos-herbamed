import { z } from 'zod';
import { jobItems } from './items';
import { formatLocation } from '../../ui/contact-format';
import { postSections, type PostSelection } from './post-selection';

export const jobPostSchema = z.object({
  id: z.uuid(), code: z.number().int().positive(), title: z.string().min(1).max(160),
  slug: z.string().min(1).max(240), city: z.string().max(100), state: z.string().max(2),
  work_model: z.string().max(50), contract_type: z.string().max(50),
  description: z.string().max(100000), requirements: z.string().max(100000),
  responsibilities: z.string().max(100000), benefits: z.string().max(100000),
  status: z.string(), visibility: z.string(),
  deadline: z.string().nullable().refine(value => value === null || Number.isFinite(Date.parse(value))),
});
export type JobPostSource = z.infer<typeof jobPostSchema>;

export function jobCanShare(job: Pick<JobPostSource, 'status' | 'visibility' | 'deadline'>, now = Date.now()) {
  return job.status === 'published' && job.visibility === 'public' &&
    (!job.deadline || Date.parse(job.deadline) > now);
}

export function publicJobUrl(base: string, slug: string) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('invalid_public_url');
  return new URL(`/vagas/${encodeURIComponent(slug)}`, url).href;
}

export function postExcerpt(value: string, limit: number) {
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > limit * 0.65 ? space : cut.length).trimEnd()}…`;
}

function highlights(value: string, count: number, length: number) {
  return jobItems(value).slice(0, count).map(item => postExcerpt(item, length));
}

export function jobPostModel(job: JobPostSource, base: string, selection?: PostSelection) {
  const requirements = highlights(job.requirements, 3, 110);
  const responsibilities = highlights(job.responsibilities, 3, 110);
  const benefits = highlights(job.benefits, 4, 65);
  return {
    title: job.title,
    location: formatLocation(job.city, job.state),
    workModel: job.work_model,
    contract: job.contract_type,
    url: publicJobUrl(base, job.slug),
    primary: selection ? { title: postSections[selection.kind].title, items: selection.items.map(item => postExcerpt(item, postSections[selection.kind].length)) }
      : requirements.length ? { title: 'Requisitos', items: requirements }
      : { title: 'Sobre a vaga', items: [postExcerpt(job.description, 250)] },
    secondary: selection ? { title: 'Benefícios', items: selection.benefits.map(item => postExcerpt(item,65)) }
      : benefits.length ? { title: 'Benefícios', items: benefits }
      : responsibilities.length ? { title: 'Responsabilidades', items: responsibilities }
      : { title: 'Como participar', items: ['Confira a descrição completa no portal e envie sua candidatura pelo link abaixo.'] },
  };
}
export type JobPostModel = ReturnType<typeof jobPostModel>;
