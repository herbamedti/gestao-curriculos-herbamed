# Testes

`supabase/tests/007_curriculum_catalogs.sql` cobre dados opcionais, idioma sem instituição, compatibilidade com clientes antigos, limites de acesso a catálogos/navegação e exclusão protegida de opções vinculadas. `node scripts/smoke-curriculum-fields.mjs` (após build) valida formulários do candidato e RH com MFA, skills, idioma, exportação PDF, edição de catálogo e publicação de vaga com marcadores, usando somente dados fictícios locais.

`npm run check` executa lint, TS, Vitest e build. `npm run test:db` roda pgTAP no Supabase local e verifica isolamento candidato, gravação direta bloqueada, MFA e candidatura aceita apenas com currículo estruturado completo, sem dependência de Storage. `npm run test:e2e` cobre a jornada local do portal; antes de produção, completar testes de PDF/RBAC, OAuth Azure real, e-mail, recuperação, fluxos LGPD e telas responsivas com tecnologias assistivas.

O pgTAP também cobre cadastro e edição pelo RH, edição de currículo de conta do portal, bloqueio de mudança do e-mail de login, vínculo com vaga publicada, currículo incompleto, duplicidade e negação para usuário comum e RH sem MFA.
`supabase/tests/006_password_staff.sql` verifica que a autorização de senha é individual, outro usuário e outro provedor continuam bloqueados, MFA segue obrigatório, bootstrap não é executável por usuários comuns e quota limita cadastros. O smoke `node scripts/smoke-demo.mjs` usa um servidor separado e somente o Supabase local para testar cadastro/login sem e-mail, ocultação de Turnstile/recuperação e configurações de Conta.
