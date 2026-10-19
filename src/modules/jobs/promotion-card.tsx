'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/ui/icon';
import { CopyLink } from '@/ui/copy-link';
import { Spinner } from '@/ui/pending-feedback';
import { Modal } from '@/ui/modal';

export function JobPromotionCard({ jobId, code, url, available }: { jobId: string; code: number; url: string; available: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState('');
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function generate() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(''); setSaved(false);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(`/api/rh/vagas/${jobId}/postagem`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        throw Error(result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'Não foi possível gerar a imagem. Tente novamente.');
      }
      if (response.headers.get('content-type') !== 'image/png') throw Error('Não foi possível gerar a imagem. Entre novamente e tente outra vez.');
      setPreview(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setMessage(error instanceof Error && error.name !== 'AbortError' ? error.message : 'A geração demorou mais que o esperado. Tente novamente.');
    } finally { clearTimeout(timeout); request.current = null; lock.current = false; setBusy(false); }
  }
  function download() {
    const link = document.createElement('a');
    link.href = preview; link.download = `vaga-${code}-herbamed.png`;
    document.body.appendChild(link); link.click(); link.remove(); setSaved(true);
  }
  return <section className="card job-promotion-card" aria-label="Divulgação da vaga">
    <h2>Divulgação da vaga</h2>
    <p className="muted">Gere uma imagem com a identidade da Herbamed e os principais dados salvos da vaga para publicar nas redes sociais.</p>
    {available ? <>
      <CopyLink url={url} />
      <button type="button" className="button primary" disabled={busy} aria-busy={busy} onClick={() => void generate()}>{busy ? <Spinner /> : <Icon name="image" />}{busy ? 'Gerando postagem…' : 'Gerar postagem'}</button>
      <p className="muted job-promotion-hint">PNG · 1080 × 1350. Salve as alterações da vaga antes de gerar. Compartilhe o link junto com a imagem.</p>
    </> : <p className="alert info">Publique uma vaga pública e mantenha o prazo de candidaturas aberto para liberar a imagem e o link de compartilhamento.</p>}
    {message && <p className="alert danger" role="alert">{message}</p>}
    {preview && <Modal title="Postagem da vaga" description="Prévia com os dados salvos. O texto é resumido para destacar as informações principais; os detalhes completos ficam no link da vaga." wide onClose={() => setPreview('')}>
      <div className="job-post-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Postagem da vaga com título, local, requisitos, benefícios e link para candidatura" width={1080} height={1350} />
        <div className="job-post-preview-actions"><button type="button" className="button primary" onClick={download}><Icon name="download" />Baixar imagem PNG</button><CopyLink url={url} />
          {saved && <p className="alert success" role="status">Download iniciado. Confira os downloads do navegador.</p>}
        </div>
      </div>
    </Modal>}
  </section>;
}
