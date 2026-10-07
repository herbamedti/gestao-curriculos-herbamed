import 'server-only';
import nodemailer from 'nodemailer';
import { features } from '@/lib/config';
import { graphMailer, MailDeliveryError } from './graph';
import { mailSchema, mailSettings, type MailMessage } from './settings';

let graph: ReturnType<typeof graphMailer> | undefined;
let graphKey: string | undefined;

export function emailConfigured() {
  return features.email && mailSettingsAvailable();
}
function mailSettingsAvailable() {
  try { mailSettings(process.env); return true; } catch { return false; }
}

export async function sendEmail(message: MailMessage, signal = AbortSignal.timeout(4000)) {
  if (!features.email) throw new MailDeliveryError('mail_disabled');
  const mail = mailSchema.parse(message);
  let settings;
  try { settings = mailSettings(process.env); } catch { throw new MailDeliveryError('mail_configuration_invalid'); }
  if (settings.provider === 'microsoft_graph') {
    const key = JSON.stringify(settings);
    if (!graph || graphKey !== key) { graph = graphMailer(settings); graphKey = key; }
    return graph.send(mail, signal);
  }
  const transport = nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.secure,
    connectionTimeout: 4000, greetingTimeout: 4000, socketTimeout: 4000,
    auth: settings.user ? { user: settings.user, pass: settings.password } : undefined });
  const abort = () => transport.close();
  signal.throwIfAborted();
  signal.addEventListener('abort', abort, { once: true });
  try { await transport.sendMail({ from: settings.from, ...mail }); }
  catch { throw new MailDeliveryError(signal.aborted ? 'mail_timeout' : 'mail_provider_unavailable'); }
  finally { signal.removeEventListener('abort', abort); transport.close(); }
}
