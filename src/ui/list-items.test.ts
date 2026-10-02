import { describe, expect, it } from 'vitest';
import { prepareListItems, textListItems } from './list-items';
describe('Inclusão de itens em listas', () => {
  it('separa ponto e vírgula, limpa vazios e mantém a ordem', () => {
    expect(prepareListItems(' Primeiro; Segundo ;; Terceiro; ', [], 30, 10000, true).items).toEqual(['Primeiro','Segundo','Terceiro']);
  });
  it('não duplica itens existentes ou repetidos no mesmo lote', () => {
    expect(prepareListItems('EXCEL; Comunicação; comunicação', ['Excel'], 30, 100, true).items).toEqual(['Excel','Comunicação']);
  });
  it('rejeita o lote inteiro quando excede quantidade ou tamanho', () => {
    expect(prepareListItems('Dois;Três', ['Um'], 2, 100, true).items).toEqual(['Um']);
    expect(prepareListItems('Um;Muito longo', [], 30, 3, true).items).toEqual([]);
    expect(prepareListItems(';;', [], 30, 100, true).error).not.toBe('');
  });
  it('mantém modo individual e não altera texto legado', () => {
    expect(prepareListItems('HTML;CSS', [], 30, 100).items).toEqual(['HTML;CSS']);
    expect(prepareListItems('Novo;Outro', ['Texto; legado'], 30, 100, true).items).toEqual(['Texto; legado','Novo','Outro']);
    expect(textListItems('Texto; legado\r\n• Outro detalhe\n- Mais um detalhe\n\n')).toEqual(['Texto; legado','Outro detalhe','Mais um detalhe']);
  });
});
