// Existing semicolons are preserved; bulk splitting only happens on addition.
export function textListItems(value: string) {
  return value.split(/\r?\n/).map(item => item.trim().replace(/^[•\-]\s+/, '')).filter(Boolean);
}

export function prepareListItems(draft: string, existing: string[], maxItems: number, maxLength: number, bulk = false) {
  const values = (bulk ? draft.split(';') : [draft]).map(value => value.trim()).filter(Boolean);
  if (!values.length) return { error: 'Digite um item antes de adicionar.', items: existing };
  if (values.some(value => value.length > maxLength)) return { error: `Cada item deve ter no máximo ${maxLength} caracteres.`, items: existing };
  const seen = new Set(existing.map(value => value.trim().toLocaleLowerCase('pt-BR')));
  const additions = values.filter(value => {
    const key = value.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  if (!additions.length) return { error: 'Estes itens já foram adicionados.', items: existing };
  if (existing.length + additions.length > maxItems) return { error: `Adicione no máximo ${maxItems} itens. Nenhum item novo foi incluído.`, items: existing };
  return { error: '', items: [...existing, ...additions] };
}
