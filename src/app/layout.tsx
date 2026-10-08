import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import 'material-symbols/outlined.css';
import './globals.css';
import { config } from '@/lib/config';
import { NavigationFeedback } from '@/ui/pending-feedback';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: config.name, template: `%s | ${config.name}` }, description: 'Encontre oportunidades e construa sua trajetória com a Herbamed.', metadataBase: new URL(config.url), icons: { icon: '/brand/folha.png' }, robots: config.environment === 'production' ? undefined : { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><a className="skip-link" href="#conteudo">Pular para o conteúdo</a>{config.environment !== 'production' && <div className="environment">Ambiente {config.environment === 'local' ? 'local' : config.environment} · utilize somente dados fictícios</div>}<NavigationFeedback>{children}</NavigationFeedback></body></html>;
}
