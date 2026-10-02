// Each existing line becomes one editable item, preserving legacy text.
export function jobItems(value: string) {
  return value.split(/\r?\n/).map(item => item.trim().replace(/^[•\-]\s+/, '')).filter(Boolean);
}
