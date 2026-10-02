type LoginError = { code?: string; status?: number; name?: string };

const diagnosticCodes = new Set([
  'invalid_credentials', 'email_not_confirmed', 'email_provider_disabled',
  'captcha_failed', 'over_request_rate_limit', 'over_email_send_rate_limit',
  'request_timeout', 'unexpected_failure', 'validation_failed', 'bad_json',
  'bad_jwt', 'not_admin', 'no_authorization', 'user_not_found', 'user_banned',
  'session_not_found', 'session_expired', 'unexpected_audience',
  'provider_disabled', 'provider_email_needs_verification',
  'email_address_invalid', 'email_address_not_authorized',
]);
const diagnosticKinds = new Set([
  'AuthApiError', 'AuthUnknownError', 'AuthRetryableFetchError',
  'AuthInvalidTokenResponseError', 'AuthInvalidCredentialsError',
  'AuthSessionMissingError', 'AuthInvalidJwtError',
]);

export function loginDiagnostic(error: LoginError, category: string) {
  const code = error.code && diagnosticCodes.has(error.code) ? error.code : 'unknown_code';
  const kind = error.name && diagnosticKinds.has(error.name) ? error.name : 'unknown_kind';
  const status = Number.isInteger(error.status) && error.status! >= 0 && error.status! <= 599
    ? error.status : 'unknown_status';
  return `${category}:${kind}:${code}:${status}`;
}

// Use fixed diagnostic codes: upstream messages can contain personal data.
export function loginFailure(error: LoginError, emailEnabled: boolean) {
  const credentialsMessage = emailEnabled
    ? 'Não foi possível entrar. Confira suas credenciais e a confirmação de e-mail.'
    : 'Não foi possível entrar. Confira seu e-mail e senha.';
  if (error.code === 'invalid_credentials' || error.code === 'email_not_confirmed') {
    return { code: 'credentials_rejected', message: credentialsMessage };
  }
  if (error.status === 429 || ['over_request_rate_limit', 'over_email_send_rate_limit'].includes(error.code ?? '')) {
    return { code: 'rate_limited', message: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' };
  }
  if (error.code === 'email_provider_disabled') {
    return { code: 'password_provider_disabled', message: 'O acesso por senha está desativado no serviço de autenticação. Procure o administrador.' };
  }
  if (error.code === 'captcha_failed') {
    return { code: 'captcha_rejected', message: 'A verificação de segurança foi recusada pelo serviço de autenticação. Procure o administrador.' };
  }
  if (error.status === 401 || error.status === 403) {
    return { code: 'backend_access_rejected', message: 'O serviço de autenticação recusou a configuração da aplicação. Procure o administrador.' };
  }
  if (error.name === 'AuthRetryableFetchError' || error.code === 'request_timeout' || (error.status ?? 0) >= 500) {
    return { code: 'backend_unavailable', message: 'O serviço de autenticação está temporariamente indisponível. Tente novamente em alguns minutos.' };
  }
  return { code: 'login_failed', message: 'Não foi possível concluir o acesso. Tente novamente ou procure o administrador.' };
}
