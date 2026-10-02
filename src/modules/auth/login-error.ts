type LoginError = { code?: string; status?: number; name?: string };

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
