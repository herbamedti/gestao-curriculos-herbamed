import { describe, expect, it } from 'vitest';
import { jobCanShare, jobPostModel, jobPostSchema, postExcerpt, publicJobUrl } from './post-model';

const job = jobPostSchema.parse({
  id: '11111111-1111-4111-8111-111111111111', code: 42, title: 'Analista fictício', slug: 'analista-ficticio',
  city: 'Cidade fictícia', state: 'SP', work_model: 'Presencial', contract_type: 'CLT',
  description: 'Descrição fictícia da oportunidade.', requirements: 'Formação fictícia\nExperiência fictícia',
  responsibilities: 'Atividade fictícia', benefits: 'Benefício fictício',
  status: 'published', visibility: 'public', deadline: null,
});

describe('Divulgação da vaga', () => {
  it('libera somente vagas públicas, publicadas e dentro do prazo', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');
    expect(jobCanShare(job, now)).toBe(true);
    for (const status of ['draft', 'pending', 'paused', 'closed', 'cancelled', 'archived']) {
      expect(jobCanShare({ ...job, status }, now)).toBe(false);
    }
    expect(jobCanShare({ ...job, visibility: 'internal' }, now)).toBe(false);
    expect(jobCanShare({ ...job, deadline: '2026-10-19T12:00:00Z' }, now)).toBe(false);
    expect(jobCanShare({ ...job, deadline: '2026-10-19T12:00:01Z' }, now)).toBe(true);
    expect(jobCanShare({ ...job, deadline: 'inválido' }, now)).toBe(false);
  });

  it('usa o endereço público configurado e mantém o slug dentro de um segmento', () => {
    expect(publicJobUrl('https://carreiras.example.test/', job.slug)).toBe('https://carreiras.example.test/vagas/analista-ficticio');
    expect(publicJobUrl('https://carreiras.example.test?preview=1', 'vaga/com?busca=texto')).toBe('https://carreiras.example.test/vagas/vaga%2Fcom%3Fbusca%3Dtexto');
    expect(() => publicJobUrl('javascript:alert(1)', job.slug)).toThrow();
    expect(() => publicJobUrl('https://user:secret@example.test', job.slug)).toThrow();
  });

  it('resume somente os dados cadastrados e mantém título e link completos', () => {
    const source = { ...job, requirements: Array(30).fill('Requisito fictício '.repeat(20)).join('\n'), benefits: Array(30).fill('Benefício fictício '.repeat(10)).join('\n') };
    const post = jobPostModel(source, 'https://carreiras.example.test');
    expect(post.primary.items).toHaveLength(3);
    expect(post.primary.items.every(item => item.length <= 110 && item.endsWith('…'))).toBe(true);
    expect(post.secondary.items).toHaveLength(4);
    expect(post.secondary.items.every(item => item.length <= 65)).toBe(true);
    expect(post.title).toBe(source.title);
    expect(post.location).toBe('Cidade fictícia, SP');
    expect(post.url).toBe('https://carreiras.example.test/vagas/analista-ficticio');
  });

  it('não inventa requisitos ou benefícios quando não foram cadastrados', () => {
    const post = jobPostModel({ ...job, requirements: '', benefits: '' }, 'https://carreiras.example.test');
    expect(post.primary).toEqual({ title: 'Sobre a vaga', items: [job.description] });
    expect(post.secondary).toEqual({ title: 'Responsabilidades', items: [job.responsibilities] });
    const minimal = jobPostModel({ ...job, requirements: '', benefits: '', responsibilities: '' }, 'https://carreiras.example.test');
    expect(minimal.secondary.title).toBe('Como participar');
  });

  it('normaliza espaços e controla o tamanho de textos sem espaços', () => {
    expect(postExcerpt('  Texto\ncom\t espaços  ', 100)).toBe('Texto com espaços');
    expect(postExcerpt('x'.repeat(500), 110)).toHaveLength(110);
    expect(jobPostSchema.safeParse({ ...job, deadline: 'inválido' }).success).toBe(false);
  });
});
