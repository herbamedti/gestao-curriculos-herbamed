# Banco de dados

`supabase/migrations` define o esquema e RLS. `202609230001_core.sql` cria entidades, índices, permissões e operações base. `202609230002_operations.sql` cria operações RH, privacidade e Storage histórico. `202609280002_structured_curriculum.sql` exige dados essenciais do currículo e dispensa documento na nova candidatura. `202609280003_curriculum_export_audit.sql` autoriza e audita a exportação PDF. `supabase/seed.sql` contém apenas dados fictícios locais.

`202609280004_staff_curriculum_and_job_link.sql` amplia o cadastro manual, permite ao RH editar perfis manuais e do portal (sem trocar o e-mail de login) e adiciona vínculo manual com vaga via RPC. A escrita direta nas tabelas de domínio continua negada; a operação exige permissão efetiva, MFA, justificativa, currículo completo e vaga publicada.

Principais relações: `auth.users` → `candidates` ou `staff`; `staff` ↔ `roles` ↔ `permissions`; `jobs` → `job_stages`, `job_questions`, `job_assignments`; `candidates` + `profile_entries` formam o currículo e `candidates` + `jobs` → `applications`; `applications` → `events`, `answers`, `evaluations`, `interviews`. `documents` conserva metadados históricos, sem uso nas novas candidaturas. `privacy_requests` e `audit_events` conservam a trilha de tratamento. Índices de vagas publicadas, candidatura por etapa, candidato, trigram e texto português atendem as consultas iniciais.

RLS: leitura pública somente de vaga publicada, catálogos ativos e aviso publicado; candidato lê o próprio dado; RH lê conforme permissão e escopo; escrita direta negada. Alterações críticas passam por RPC `SECURITY DEFINER` com verificação de permissão. `npm run test:db` comprova isolamento e MFA básico. Use `EXPLAIN (ANALYZE, BUFFERS)` com dados representativos antes de ajustar buscas para produção.

`npm run db:types` usa `supabase gen types typescript --local --schema public` e substitui `src/lib/database.types.ts`. O gerador PGlite em `scripts/schema-check.mjs` valida sintaxe sem Docker; tipos de produção devem ser regenerados pelo Supabase CLI após migrações.
