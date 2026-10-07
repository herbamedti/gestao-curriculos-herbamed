import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { graphMailer } from './graph';
import { mailSettings, webhookSecret, type GraphSettings } from './settings';

const settings: GraphSettings = { provider: 'microsoft_graph',
  tenantId: '00000000-0000-4000-8000-000000000001', clientId: '00000000-0000-4000-8000-000000000002',
  clientSecret: 'secret-ficticio', sender: 'carreiras@example.test' };
const message = { to: 'candidate@example.test', subject: 'Confirmação', text: 'Mensagem de teste' };
const token = () => Response.json({ access_token: 'token-ficticio', token_type: 'Bearer', expires_in: 3600 });

describe('Microsoft Graph no servidor', () => {
  it('usa client credentials, remetente fixo e somente sendMail; reaproveita o token', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(token())
      .mockResolvedValue(new Response(null, { status: 202 }));
    const mailer = graphMailer(settings, request);
    await mailer.send(message); await mailer.send(message);
    expect(request).toHaveBeenCalledTimes(3);
    const body = request.mock.calls[0][1]?.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({ client_id: settings.clientId, client_secret: settings.clientSecret,
      grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' });
    expect(request.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users/carreiras%40example.test/sendMail');
    expect(JSON.parse(request.mock.calls[1][1]?.body as string)).toEqual({ message: {
      subject: message.subject, body: { contentType: 'Text', content: message.text },
      toRecipients: [{ emailAddress: { address: message.to } }] }, saveToSentItems: true });
  });
  it('renova token antes de expirar e compartilha uma solicitação concorrente', async () => {
    let clock = 0;
    const request = vi.fn<typeof fetch>().mockImplementation(async url =>
      String(url).includes('/token') ? token() : new Response(null, { status: 202 }));
    const mailer = graphMailer(settings, request, () => clock);
    await Promise.all([mailer.send(message), mailer.send(message)]);
    expect(request.mock.calls.filter(([url]) => String(url).includes('/token'))).toHaveLength(1);
    clock = 3540001; await mailer.send(message);
    expect(request.mock.calls.filter(([url]) => String(url).includes('/token'))).toHaveLength(2);
  });
  it.each([[401, 'mail_credentials_rejected'], [403, 'mail_permission_denied'], [429, 'mail_rate_limited'],
    [500, 'mail_provider_unavailable']])('não repete envio nem expõe resposta privada em HTTP %s', async (status, code) => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(token())
      .mockResolvedValue(new Response('dados privados do provedor', { status: Number(status) }));
    await expect(graphMailer(settings, request).send(message)).rejects.toThrow(String(code));
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('invalida token rejeitado para a próxima solicitação', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(token())
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response(null, { status: 202 }));
    const mailer = graphMailer(settings, request);
    await expect(mailer.send(message)).rejects.toThrow('mail_credentials_rejected');
    await mailer.send(message); expect(request).toHaveBeenCalledTimes(4);
  });
  it('recusa uma resposta de token inválida e erros de rede sem vazar detalhes', async () => {
    await expect(graphMailer(settings, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ access_token: 'private' })))
      .send(message)).rejects.toThrow('mail_invalid_token_response');
    await expect(graphMailer(settings, vi.fn<typeof fetch>().mockRejectedValue(new Error('segredo')))
      .send(message)).rejects.toThrow('mail_provider_unavailable');
  });
  it('mantém SMTP local como padrão e exige credenciais próprias para Graph', () => {
    expect(mailSettings({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '54325' }).provider).toBe('smtp');
    expect(() => mailSettings({ EMAIL_PROVIDER: 'microsoft_graph', SMTP_HOST: '127.0.0.1' })).toThrow();
    expect(() => mailSettings({ EMAIL_PROVIDER: 'outro' })).toThrow();
    const raw = Buffer.alloc(32, 1).toString('base64');
    expect(webhookSecret(`v1,whsec_${raw}`)).toBe(`whsec_${raw}`);
    expect(() => webhookSecret('whsec_YQ==')).toThrow();
  });
});
