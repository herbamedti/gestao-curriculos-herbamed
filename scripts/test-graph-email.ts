import { graphMailer, MailDeliveryError } from '../src/modules/email/graph';
import { mailSettings, mailSchema } from '../src/modules/email/settings';

// Explicit opt-in: this diagnostic sends one real message. It never prints
// credentials, recipients, raw responses, tokens or message bodies.
async function main() {
  if (!process.argv.includes('--send')) {
    console.error('Use npm run email:test -- --send para enviar uma mensagem de teste com .env.graph.local.');
    process.exitCode = 1;
    return;
  }
  try {
    const settings = mailSettings(process.env);
    if (settings.provider !== 'microsoft_graph') throw new Error('mail_configuration_invalid');
    const message = mailSchema.parse({ to: process.env.EMAIL_TEST_TO,
      subject: 'Teste de envio Herbamed Carreiras',
      text: 'Esta mensagem confirma um teste de envio da plataforma Herbamed Carreiras pelo Microsoft Graph. Não contém dados de candidatos.' });
    await graphMailer(settings).send(message);
    console.log('Mensagem aceita pelo Microsoft Graph. Confirme o recebimento na caixa de teste.');
  } catch (error) {
    console.error(`Teste falhou: ${error instanceof MailDeliveryError ? error.code : 'mail_configuration_invalid'}.`);
    process.exitCode = 1;
  }
}

void main();
