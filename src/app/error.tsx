'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="conteudo" className="container page-section"><div className="empty"><h1>Não foi possível carregar esta página</h1><p>O serviço pode estar temporariamente indisponível. Seus dados salvos continuam preservados.</p><button className="button primary" onClick={reset}>Tentar novamente</button><Link href="/">Voltar ao início</Link></div></main>; }
