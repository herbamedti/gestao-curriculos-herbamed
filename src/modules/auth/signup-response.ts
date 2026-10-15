// Do not reveal whether an email belongs to an existing account.
// The Auth database owns account uniqueness; no public availability query.
export const signupAcknowledgement = { ok:true, message:'Confira seu e-mail para confirmar a conta. Se já possui cadastro, entre ou recupere a sua senha.',redirect:'/entrar?cadastro=confirmar-email' } as const;
export function existingSignup(error:{code?:string}|null|undefined) {
  return Boolean(error?.code && ['user_already_exists','email_exists','identity_already_exists'].includes(error.code));
}
