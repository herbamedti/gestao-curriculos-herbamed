import { z } from 'zod';

// Check digits validate the number's structure, not ownership or Receita status.
export function validCpf(value: string) {
  if (!/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (/^(\d)\1{10}$/.test(digits)) return false;
  for (const length of [9, 10]) {
    const sum = [...digits.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const check = (sum * 10) % 11 % 10;
    if (check !== Number(digits[length])) return false;
  }
  return true;
}
export function validBirthDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= today;
}
export const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(12, 'A senha deve ter pelo menos 12 caracteres.').max(128),
  cpf: z.string().trim().max(14).refine(validCpf, 'Informe um CPF válido.').transform(value => value.replace(/\D/g, '')),
  birth_date: z.string().refine(value => validBirthDate(value), 'Informe uma data de nascimento válida, que não esteja no futuro.'),
});
