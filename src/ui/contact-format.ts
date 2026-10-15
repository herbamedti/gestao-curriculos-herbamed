function brazilianPhone(value: string) {
  const phone = value.trim();
  if (!/^\+?[\d ().-]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, '');
  const country = digits.startsWith('55') && [12, 13].includes(digits.length);
  if (phone.startsWith('+') && !country) return null;
  const national = country ? digits.slice(2) : digits;
  return [10, 11].includes(national.length) ? { national, country } : null;
}

/** Formatting only: preserve international, incomplete and legacy values. */
export function formatPhone(value: string | null | undefined) {
  if (!value) return '';
  const phone = brazilianPhone(value);
  if (!phone) return value.trim();
  const { national, country } = phone;
  const split = national.length === 11 ? 7 : 6;
  return `${country ? '+55 ' : ''}(${national.slice(0, 2)}) ${national.slice(2, split)}-${national.slice(split)}`;
}

export function phoneHref(value: string | null | undefined) {
  if (!value) return undefined;
  const phone = brazilianPhone(value);
  if (phone) return `tel:+55${phone.national}`;
  if (!/^\+[\d ().-]+$/.test(value.trim())) return undefined;
  const digits = value.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? `tel:+${digits}` : undefined;
}

export function formatLocation(city: string | null | undefined, state: string | null | undefined) {
  return [city?.trim(), state?.trim()].filter(Boolean).join(', ');
}
