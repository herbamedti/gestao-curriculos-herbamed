import { describe, expect, it } from 'vitest';
import { formatLocation, formatPhone, phoneHref } from './contact-format';

describe('Apresentação dos contatos', () => {
  it('formata celular e telefone fixo, incluindo DDI brasileiro, de forma idempotente', () => {
    for (const [value, expected] of [
      ['11999999999', '(11) 99999-9999'],
      ['4733334444', '(47) 3333-4444'],
      ['5511999999999', '+55 (11) 99999-9999'],
      ['+55 (47) 3333-4444', '+55 (47) 3333-4444'],
    ]) {
      expect(formatPhone(value)).toBe(expected);
      expect(formatPhone(expected)).toBe(expected);
      expect(phoneHref(value)).toBe(phoneHref(expected));
    }
    expect(phoneHref('4733334444')).toBe('tel:+554733334444');
  });

  it('preserva números internacionais, incompletos e valores legados sem truncar', () => {
    for (const value of ['+1 202 555 0100', '+44 20 7946 0000', '11999', '(47) 3333-4444 ramal 20']) {
      expect(formatPhone(value)).toBe(value);
    }
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
    expect(phoneHref('+1 202 555 0100')).toBe('tel:+12025550100');
    expect(phoneHref('11999')).toBeUndefined();
    expect(phoneHref('(47) 3333-4444 ramal 20')).toBeUndefined();
  });

  it('não converte texto nem instruções de URI em links de telefone', () => {
    for (const value of ['javascript:11999999999', '11999999999?body=texto', '11999999999\n123', '+1 202 555 0100;ext=10']) {
      expect(phoneHref(value)).toBeUndefined();
    }
  });

  it('omite separadores da localização quando parte do cadastro está vazia', () => {
    expect(formatLocation(' Cidade fictícia ', ' SP ')).toBe('Cidade fictícia, SP');
    expect(formatLocation('', 'SP')).toBe('SP');
    expect(formatLocation('Cidade fictícia', null)).toBe('Cidade fictícia');
    expect(formatLocation(undefined, '')).toBe('');
  });
});
