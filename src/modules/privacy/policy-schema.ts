import { z } from 'zod';

export const POLICY_BODY_LIMIT = 100000;
export const policySchema = z.object({
  version: z
    .string()
    .trim()
    .min(2, 'Informe uma versão com pelo menos 2 caracteres.')
    .max(40, 'A versão deve ter até 40 caracteres.'),
  title: z
    .string()
    .trim()
    .min(5, 'Informe um título com pelo menos 5 caracteres.')
    .max(160, 'O título deve ter até 160 caracteres.'),
  // Browser multipart submissions can turn each line break into CRLF.
  body: z
    .string()
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(
      z
        .string()
        .min(100, 'O texto integral deve ter pelo menos 100 caracteres.')
        .max(POLICY_BODY_LIMIT, 'O texto integral deve ter até 100.000 caracteres.'),
    ),
});
