import { postSelectionSchema } from './post-selection';

export async function readPostSelection(request: Request, configuredOrigin?: string) {
  const origin = request.headers.get('origin');
  // Reverse proxies may expose an internal Request URL. APP_URL is a trusted
  // server setting; never derive this additional allowed origin from headers.
  const allowedOrigins = [new URL(request.url).origin, configuredOrigin].filter(Boolean);
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && !allowedOrigins.includes(origin)))
    return { ok: false as const, status: 403, message: 'Abra a geração de postagem pelo próprio sistema.' };
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    return { ok: false as const, status: 415, message: 'Envie os textos em formato JSON.' };
  const limit = 256 * 1024;
  const oversized = { ok: false as const, status: 413, message: 'Os textos excedem o limite permitido. Reduza o conteúdo.' };
  if (Number(request.headers.get('content-length')) > limit) return oversized;
  const reader = request.body?.getReader();
  if (!reader) return { ok: false as const, status: 400, message: 'Selecione os textos da postagem.' };
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) { await reader.cancel(); return oversized; }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed = postSelectionSchema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    if (!parsed.success) return { ok: false as const, status: 422, message: parsed.error.issues[0]?.message || 'Revise os textos selecionados.' };
    return { ok: true as const, data: parsed.data };
  } catch {
    return { ok: false as const, status: 400, message: 'Não foi possível ler os textos. Revise e tente novamente.' };
  } finally { reader.releaseLock(); }
}
