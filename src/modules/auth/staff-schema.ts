import { z } from 'zod';

export const staffPassword = z.string().min(12).max(128).refine(value => /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9\s]/.test(value), 'Use 12 a 128 caracteres, com maiúsculas, minúsculas, números e símbolos.');
export const staffPermissions = z.record(z.string().max(80), z.boolean()).refine(value => Object.keys(value).length <= 100 && !('users.manage' in value) && !('roles.manage' in value), 'Estas permissões são exclusivas do administrador principal.');
export const staffDetailsSchema = z.array(z.object({
  user_id: z.uuid(), created_at: z.string(), pending: z.boolean(), confirmed: z.boolean(),
  delivery: z.enum(['pending', 'sent', 'failed']).nullable(), sent_at: z.string().nullable(), permissions: staffPermissions,
}));
export type StaffDetails = z.infer<typeof staffDetailsSchema>[number];
