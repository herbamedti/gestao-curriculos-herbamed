import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { policySchema } from './policy-schema';
import { PolicyBody } from './policy-body';

describe('Avisos de privacidade', () => {
  it('aceita textos extensos e rejeita limites inválidos com mensagem específica', () => {
    const input = { version: '01', title: 'Aviso fictício', body: 'Texto fictício. '.repeat(2000) };
    expect(policySchema.safeParse(input).success).toBe(true);
    expect(policySchema.parse({ ...input, body: input.body + '\r\n\r\nFim.' }).body).toBe(
      input.body + '\n\nFim.',
    );
    expect(policySchema.safeParse({ ...input, body: 'a'.repeat(100000) }).success).toBe(true);
    const excess = policySchema.safeParse({ ...input, body: 'a'.repeat(100001) });
    expect(excess.success).toBe(false);
    if (!excess.success) expect(excess.error.issues[0].message).toContain('100.000');
    for (const changes of [{ version: '1' }, { title: 'a' }, { body: 'a'.repeat(99) }])
      expect(policySchema.safeParse({ ...input, ...changes }).success).toBe(false);
  });
  it('exibe títulos, destaques e listas com todo o conteúdo', () => {
    const html = renderToStaticMarkup(
      <PolicyBody
        body={
          '# Aviso\r\n**Versão:** 01\n\n## Direitos\n- Primeiro direito\n- Segundo direito\n\n1. Primeira ação\n2. Segunda ação\n\nFim do aviso.'
        }
      />,
    );
    for (const text of [
      '<h3>Aviso</h3>',
      '<strong>Versão:</strong>',
      '<li>Primeiro direito</li>',
      '<li>Segundo direito</li>',
      '<ol>',
      'Fim do aviso.',
    ])
      expect(html).toContain(text);
  });
  it('mantém HTML e scripts como texto, sem executar conteúdo do aviso', () => {
    const html = renderToStaticMarkup(
      <PolicyBody
        body={'<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n**Destaque seguro**'}
      />,
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<strong>Destaque seguro</strong>');
  });
});
