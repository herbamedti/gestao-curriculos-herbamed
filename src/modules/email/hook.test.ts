import { describe, expect, it, vi } from 'vitest';
import { Webhook } from 'standardwebhooks';
import { authMessages } from './auth-messages';
import { emailHook, type DeliveryClaim } from './hook';

const secret = `whsec_${Buffer.alloc(32, 7).toString('base64')}`;
const lease = '00000000-0000-4000-8000-000000000005';
const payload = { user: { id: '00000000-0000-4000-8000-000000000001', email: 'old@example.test', new_email: 'new@example.test' },
  email_data: { email_action_type: 'signup', token: '123456', token_new: '654321',
    token_hash: 'a'.repeat(64), token_hash_new: 'b'.repeat(64),
    redirect_to: 'https://evil.example.test', site_url: 'https://evil.example.test' } };
function signed(value: unknown = payload, date = new Date()) {
  const body = JSON.stringify(value);
  return new Request('https://app.example.test/api/auth/send-email', { method: 'POST', body,
    headers: { 'content-type': 'application/json', 'webhook-id': 'test-message',
      'webhook-timestamp': String(Math.floor(date.getTime() / 1000)),
      'webhook-signature': new Webhook(secret).sign('test-message', date, body) } });
}
function dependencies() {
  return { enabled: true, secret: `v1,${secret}`, appUrl: 'https://app.example.test',
    claim: vi.fn<(key: string) => Promise<DeliveryClaim>>().mockResolvedValue({ state: 'claimed', lease }),
    finish: vi.fn().mockResolvedValue(undefined), send: vi.fn().mockResolvedValue(undefined), diagnostic: vi.fn() };
}
describe('Auth Hook assinado', () => {
  it('entrega somente payload assinado, valida schema e usa o domínio configurado', async () => {
    const deps = dependencies();
    expect((await emailHook(deps)(signed())).status).toBe(200);
    const message = deps.send.mock.calls[0][0];
    expect(message.to).toBe('old@example.test');
    expect(message.text).toContain('https://app.example.test/auth/confirm?token_hash=');
    expect(message.text).not.toContain('evil');
    expect(deps.claim.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(deps.finish).toHaveBeenCalledWith(expect.any(String), lease, true);
  });
  it('recusa assinatura adulterada, ausente, expirada ou futura sem chamar o banco', async () => {
    const requests = [signed(), signed(), signed(payload, new Date(Date.now() - 360000)),
      signed(payload, new Date(Date.now() + 360000))];
    requests[0].headers.set('webhook-signature', 'v1,adulterada');
    requests[1].headers.delete('webhook-id');
    for (const request of requests) {
      const deps = dependencies(); expect((await emailHook(deps)(request)).status).toBe(401);
      expect(deps.claim).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalled();
    }
  });
  it('não aceita destinatários arbitrários ou ações desconhecidas no corpo', async () => {
    const deps = dependencies();
    expect((await emailHook(deps)(signed({ ...payload, user: { ...payload.user, email: 'inválido' } }))).status).toBe(400);
    expect((await emailHook(deps)(signed({ ...payload, email_data: { ...payload.email_data, email_action_type: 'outro' } }))).status).toBe(400);
    expect(deps.send).not.toHaveBeenCalled();
  });
  it('recusa mensagens quando desativado ou sem segredo, e limita o corpo', async () => {
    const deps = dependencies(); deps.enabled = false;
    expect((await emailHook(deps)(signed())).status).toBe(503);
    expect((await emailHook({ ...deps, enabled: true, secret: undefined })(signed())).status).toBe(503);
    expect((await emailHook({ ...deps, enabled: true })(signed('x'.repeat(65537)))).status).toBe(413);
    expect(deps.send).not.toHaveBeenCalled();
  });
  it('confirma retries entregues sem reenviar e não disputa uma entrega em andamento', async () => {
    const deps = dependencies(); deps.claim.mockResolvedValue({ state: 'sent' });
    expect((await emailHook(deps)(signed())).status).toBe(200); expect(deps.send).not.toHaveBeenCalled();
    deps.claim.mockResolvedValue({ state: 'busy' });
    expect((await emailHook(deps)(signed())).status).toBe(503); expect(deps.send).not.toHaveBeenCalled();
  });
  it('libera o recibo após falha e responde sem dados privados do provedor', async () => {
    const deps = dependencies(); deps.send.mockRejectedValue(new Error('dados privados'));
    const response = await emailHook(deps)(signed());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('dados privados');
    expect(deps.finish).toHaveBeenCalledWith(expect.any(String), lease, false);
  });
  it('preserva a troca segura: hash _new para e-mail atual e hash normal para o novo', async () => {
    const changed = { ...payload, email_data: { ...payload.email_data, email_action_type: 'email_change' } };
    const messages = authMessages(changed, 'https://app.example.test');
    expect(messages[0].to).toBe('old@example.test'); expect(messages[0].text).toContain('b'.repeat(64));
    expect(messages[1].to).toBe('new@example.test'); expect(messages[1].text).toContain('a'.repeat(64));
    expect(() => authMessages({ ...changed, email_data: { ...changed.email_data, token_hash_new: '' } },
      'https://app.example.test')).toThrow('secure_email_change_required');
    const deps = dependencies(); deps.claim.mockResolvedValueOnce({ state: 'sent' });
    expect((await emailHook(deps)(signed(changed))).status).toBe(200);
    expect(deps.send).toHaveBeenCalledTimes(1); expect(deps.send.mock.calls[0][0].to).toBe('new@example.test');
  });
  it.each(['recovery', 'invite', 'magiclink', 'reauthentication'])('gera mensagem de %s', type => {
    const messages = authMessages({ ...payload, email_data: { ...payload.email_data, email_action_type: type } }, 'https://app.example.test');
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain(type === 'reauthentication' ? '123456' : `type=${type}`);
  });
});
