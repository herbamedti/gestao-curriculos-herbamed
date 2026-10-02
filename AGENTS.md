# Orientações para agentes

- Respeite o monólito Next.js e módulos em `src/modules`; UI em `src/ui`; migrations em `supabase/migrations`. Não introduza service role em componentes de browser.
- TypeScript estrito e Zod nas fronteiras. Nunca confie no menu como autorização: página, RPC, RLS e Storage precisam concordar.
- Toda alteração de schema é migration nova. Ative RLS e declare políticas explícitas; escrita direta em tabelas de domínio é proibida sem revisão.
- Preserve tokens em `src/ui/tokens.css`, Material 3, responsividade e pt-BR. Não invente dados/indicadores em produção.
- Comandos: `npm run check`, `npm run test:db`, `npm run db:types`, `docker compose up -d --build`.
- Nunca inclua currículos, chaves, tokens, e-mails reais, logs de PII ou `.env` no Git. Seeds são fictícios e locais. Não desligue ou apague outros containers do host.
- Upload só libera documentos após scanner. Não enfraqueça MFA/RBAC para facilitar teste. Atualize documentação e matriz de estado quando concluir funcionalidade.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
