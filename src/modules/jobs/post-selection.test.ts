import { describe, expect, it } from 'vitest';
import { postSelectionSchema } from './post-selection';
import { readPostSelection } from './post-request';
import { jobPostModel, jobPostSchema } from './post-model';

const selection = { kind: 'responsibilities', items: ['Atividade fictícia editada'], benefits: [] };
function request(body: string, headers: Record<string,string> = {}) {
  return new Request('https://carreiras.example.test/api/rh/vagas/id/postagem', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
}
describe('Seleção temporária dos textos da postagem', () => {
  it('aceita edição e textos longos com limites de itens, sem permitir metadados externos', () => {
    expect(postSelectionSchema.parse(selection)).toEqual(selection);
    expect(postSelectionSchema.safeParse({ ...selection, items: ['x'.repeat(2000)] }).success).toBe(true);
    for (const value of [
      { ...selection, items: [] }, { ...selection, items: ['  '] }, { ...selection, items: Array(4).fill('Item') },
      { ...selection, benefits: Array(5).fill('Item') }, { ...selection, items: ['x'.repeat(10001)] },
      { ...selection, kind: 'description', items: ['Um', 'Dois'] },
      { ...selection, url: 'https://other.example.test' }, { ...selection, title: 'Outro título' },
    ]) expect(postSelectionSchema.safeParse(value).success).toBe(false);
  });

  it('renderiza somente a seleção, mantém metadados da vaga e não modifica a origem', () => {
    const job = jobPostSchema.parse({ id:'11111111-1111-4111-8111-111111111111',code:42,title:'Vaga fictícia',slug:'vaga-ficticia',city:'Cidade fictícia',state:'SP',work_model:'Presencial',contract_type:'CLT',description:'Descrição original',requirements:'Requisito original',responsibilities:'Responsabilidade original',benefits:'Benefício original',status:'published',visibility:'public',deadline:null });
    const original = structuredClone(job);
    const post = jobPostModel(job, 'https://carreiras.example.test', postSelectionSchema.parse(selection));
    expect(post.primary).toEqual({ title: 'Responsabilidades', items: selection.items });
    expect(post.secondary.items).toEqual([]);
    expect(post.title).toBe(job.title);
    expect(post.url).toBe('https://carreiras.example.test/vagas/vaga-ficticia');
    expect(job).toEqual(original);
    const long = jobPostModel(job, 'https://carreiras.example.test', postSelectionSchema.parse({ ...selection,items:['x'.repeat(1000)] }));
    expect(long.primary.items[0]).toHaveLength(110);
  });

  it('valida JSON, tipo de conteúdo, origem e tamanho real do corpo', async () => {
    expect((await readPostSelection(request(JSON.stringify(selection)))).ok).toBe(true);
    const internal = new Request('http://0.0.0.0:3000/api/postagem', { method:'POST',headers:{'content-type':'application/json',origin:'https://carreiras.example.test'},body:JSON.stringify(selection) });
    expect((await readPostSelection(internal,'https://carreiras.example.test')).ok).toBe(true);
    expect((await readPostSelection(request('{'))).ok).toBe(false);
    expect((await readPostSelection(request(JSON.stringify(selection), { origin: 'https://other.example.test' })))).toMatchObject({ ok:false,status:403 });
    expect((await readPostSelection(request(JSON.stringify(selection), { 'content-type':'text/plain' })))).toMatchObject({ ok:false,status:415 });
    expect((await readPostSelection(request('x'.repeat(256*1024+1))))).toMatchObject({ ok:false,status:413 });
    expect((await readPostSelection(request(JSON.stringify({ ...selection, items:[] }))))).toMatchObject({ ok:false,status:422 });
  });
});
