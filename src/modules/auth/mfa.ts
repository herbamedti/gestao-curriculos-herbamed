'use server';
import { z } from 'zod';
import { session } from './session';
export type MfaState = { message: string; factorId?: string; qr?: string; secret?: string; done?: boolean };
export async function enrollMfa(): Promise<MfaState> {
  const { client } = await session();
  const { data: factors } = await client.auth.mfa.listFactors();
  if (factors?.totp.length)
    return { message: 'Use o código do autenticador já cadastrado.', factorId: factors.totp[0].id };
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Herbamed Carreiras',
  });
  if (error || !data) return { message: 'Não foi possível iniciar o cadastro do autenticador.' };
  return {
    message: 'Escaneie o QR code e informe o código de seis dígitos.',
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
  };
}
export async function verifyMfa(_: MfaState, form: FormData): Promise<MfaState> {
  try {
    const factorId = z.uuid().parse(form.get('factor_id'));
    const code = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get('code'));
    const { client } = await session();
    const { data: challenge, error } = await client.auth.mfa.challenge({ factorId });
    if (error || !challenge)
      return { message: 'Não foi possível gerar o desafio. Tente novamente.', factorId };
    const { error: verifyError } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError)
      return { message: 'Código inválido ou expirado. Verifique seu autenticador.', factorId };
    return { message: 'Autenticação concluída.', done: true };
  } catch {
    return { message: 'Informe o código de seis dígitos.' };
  }
}
