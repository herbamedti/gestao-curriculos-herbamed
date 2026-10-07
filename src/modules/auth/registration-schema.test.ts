import { describe, it, expect } from 'vitest';
import { registrationSchema, candidateIdentificationSchema, validBirthDate, validCpf } from './registration-schema';
import { signupQuotaKeys } from './signup-origin';

describe('Cadastro público', () => {
  it('exige identificação no cadastro Google sem exigir senha ou confiar no e-mail do formulário', () => {
    const identification={cpf:'529.982.247-25',birth_date:'1995-06-15'};
    expect(candidateIdentificationSchema.parse({...identification,email:'forged@example.test',user_id:'other'})).toEqual({cpf:'52998224725',birth_date:'1995-06-15'});
    for(const value of [{}, {...identification,cpf:'52998224724'}, {...identification,birth_date:'2099-01-01'}])expect(candidateIdentificationSchema.safeParse(value).success).toBe(false);
  });
  it('valida ambos os dígitos do CPF e rejeita repetições ou conteúdo adicional', () => {
    expect(validCpf('52998224725')).toBe(true);
    expect(validCpf('529.982.247-25')).toBe(true);
    for (const value of ['52998224724', '52998224735', '11111111111', '00000000000', 'texto52998224725', '529-982-247-25', '52998224725;DROP TABLE users']) expect(validCpf(value)).toBe(false);
  });
  it('normaliza e-mail/CPF e exige todos os dados antes do envio', () => {
    const input = { email: ' Candidate@Example.test ', password: 'Teste!Password123', cpf: '529.982.247-25', birth_date: '1995-06-15' };
    expect(registrationSchema.parse(input)).toMatchObject({ email: 'candidate@example.test', cpf: '52998224725' });
    for (const changes of [{ email: 'candidate@' }, { email: 'a@example.test\r\nBCC:a@b.test' }, { cpf: '' }, { birth_date: '' }, { password: 'short' }]) expect(registrationSchema.safeParse({ ...input, ...changes }).success).toBe(false);
  });
  it('valida calendário, ano bissexto e data atual no fuso brasileiro', () => {
    const now = new Date('2026-10-07T01:00:00Z');
    expect(validBirthDate('2026-10-06', now)).toBe(true);
    expect(validBirthDate('2026-10-07', now)).toBe(false);
    expect(validBirthDate('2000-02-29', now)).toBe(true);
    for (const date of ['1999-02-29', '2026-02-31', '1899-01-01', '2030-01-01', '06/10/2026']) expect(validBirthDate(date, now)).toBe(false);
  });
  it('usa origem confiável da Vercel e não permite falsificar origem fora dela', () => {
    const first = new Headers({ 'x-forwarded-for': '192.0.2.1' });
    const second = new Headers({ 'x-forwarded-for': '192.0.2.2' });
    expect(signupQuotaKeys(first, 'secret', 'a@example.test', false).origin).toBe(signupQuotaKeys(second, 'secret', 'a@example.test', false).origin);
    expect(signupQuotaKeys(first, 'secret', 'a@example.test', true).origin).not.toBe(signupQuotaKeys(second, 'secret', 'a@example.test', true).origin);
    const keys = signupQuotaKeys(new Headers({ 'x-vercel-forwarded-for': '192.0.2.1', 'x-forwarded-for': '192.0.2.2' }), 'secret', 'a@example.test', true);
    expect(keys.origin).toBe(signupQuotaKeys(first, 'secret', 'A@example.test', true).origin);
    expect(JSON.stringify(keys)).not.toContain('192.0.2.1');
    expect(JSON.stringify(keys)).not.toContain('a@example.test');
  });
});
