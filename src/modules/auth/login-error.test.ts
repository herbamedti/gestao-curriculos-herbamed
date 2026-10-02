import { describe, expect, it } from 'vitest';
import { loginDiagnostic, loginFailure } from './login-error';

describe('diagnóstico do login', () => {
  it('mantém a mesma resposta para credenciais inválidas e e-mail não confirmado', () => {
    expect(loginFailure({ code: 'invalid_credentials', status: 400 }, false))
      .toEqual(loginFailure({ code: 'email_not_confirmed', status: 400 }, false));
  });

  it('distingue rejeição da configuração de credenciais inválidas, inclusive HTTP 401', () => {
    expect(loginFailure({ status: 401 }, false).code).toBe('backend_access_rejected');
    expect(loginFailure({ code: 'invalid_credentials', status: 401 }, false).code).toBe('credentials_rejected');
  });

  it('identifica limite, indisponibilidade e provedor sem sugerir trocar a senha', () => {
    expect(loginFailure({ status: 429 }, false).code).toBe('rate_limited');
    expect(loginFailure({ name: 'AuthRetryableFetchError', status: 0 }, false).code).toBe('backend_unavailable');
    expect(loginFailure({ status: 503 }, false).code).toBe('backend_unavailable');
    expect(loginFailure({ code: 'email_provider_disabled', status: 422 }, false).code).toBe('password_provider_disabled');
    expect(loginFailure({ code: 'captcha_failed', status: 400 }, false).code).toBe('captcha_rejected');
  });

  it('não devolve detalhes arbitrários do erro em mensagens ou códigos', () => {
    const result = loginFailure({ code: 'detalhe-privado', name: 'detalhe-privado', status: 400 }, false);
    expect(JSON.stringify(result)).not.toContain('detalhe-privado');
    expect(result.code).toBe('login_failed');
    expect(loginDiagnostic({ code: 'detalhe-privado', name: 'detalhe-privado', status: Infinity }, result.code))
      .toBe('login_failed:unknown_kind:unknown_code:unknown_status');
    expect(loginDiagnostic({ code: 'bad_jwt', name: 'AuthApiError', status: 400 }, result.code))
      .toBe('login_failed:AuthApiError:bad_jwt:400');
  });
});
