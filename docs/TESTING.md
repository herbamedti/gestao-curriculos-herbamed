# Testes

`npm run check` executa lint, TS, Vitest e build. `npm run test:db` roda pgTAP no Supabase local e verifica isolamento candidato, gravação direta bloqueada, MFA e candidatura aceita apenas com currículo estruturado completo, sem dependência de Storage. `npm run test:e2e` cobre a jornada local do portal; antes de produção, completar testes de PDF/RBAC, OAuth Azure real, e-mail, recuperação, fluxos LGPD e telas responsivas com tecnologias assistivas.

O pgTAP também cobre cadastro e edição pelo RH, edição de currículo de conta do portal, bloqueio de mudança do e-mail de login, vínculo com vaga publicada, currículo incompleto, duplicidade e negação para usuário comum e RH sem MFA.
