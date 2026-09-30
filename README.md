# Herbamed Carreiras

Plataforma de carreiras e recrutamento da Herbamed. TypeScript estrito, Next.js, PostgreSQL/Supabase, RBAC/RLS e Docker. O currículo fica em dados estruturados no banco e pode ser exportado em PDF. O nome público pode ser alterado por `APP_NAME`; a configuração no painel registra o valor administrativo.

## Rodar localmente no Windows

Requisitos: Node.js 24, npm 12 e Docker Desktop **em execução** com Linux containers. Não use dados pessoais reais no ambiente local.

```powershell
cd C:\projetos\gestao-curriculos-herbamed
npm ci
npm run local:start
```

Acesse [portal](http://localhost:3000), [Supabase Studio](http://127.0.0.1:54323) e [e-mails locais](http://127.0.0.1:54324). `local:start` inicia o Supabase reduzido e a aplicação; na primeira execução, também chama `local:setup`, que cria `.env` e `.env.local` ignorados pelo Git e **imprime uma senha temporária nova** para `rh.demo@herbamed.test` e `candidata.demo@example.test`. Ele reinicia o MFA da conta RH fictícia. Na conta RH, configure o autenticador TOTP em `/seguranca` antes de abrir `/rh`. O nome e a senha do usuário RH são exclusivos do banco local; a produção exige Entra ID.

O currículo agora é preenchido na plataforma e exportado em PDF. Upload, Supabase Storage, worker e ClamAV permanecem no código para referência histórica, mas ficam desativados no modo padrão. O PDF é gerado sob demanda e não é salvo no Storage. Veja `docker compose ps` e logs com `docker compose logs -f app`.

Na área RH, **Candidatos → Cadastrar currículo** registra um perfil manual com origem, finalidade e base legal. Após salvar, o gestor pode acrescentar e editar experiências, formação, cursos, certificações e idiomas no perfil. A mesma tela permite editar currículos criados pelas próprias pessoas candidatas, sem alterar o e-mail usado para login. Quando os dados essenciais estiverem completos, a seção **Vincular a uma vaga** cria uma candidatura para uma vaga publicada, exige motivo e impede duplicidade. O acesso depende das permissões de RH e MFA.

## Comandos frequentes

| Tarefa | Comando |
| --- | --- |
| Iniciar tudo | `npm run local:start` |
| Iniciar apenas Supabase reduzido | `npm run db:start` |
| Iniciar apenas a aplicação (com Supabase já ativo) | `docker compose up -d --build` |
| Parar aplicação | `docker compose down` |
| Parar Supabase (preserva dados) | `npm run db:stop` |
| Resetar **somente o banco local** e semear fictícios | `npm run db:reset` e `npm run local:setup` |
| Aplicar migrations locais novas | `npm run db:migrate` |
| Gerar tipos do banco local | `npm run db:types` |
| Lint, TypeScript, testes e build | `npm run check` |
| Testar RLS no Supabase local | `npm run test:db` |
| Rodar frontend sem container | `npm run dev` |

O primeiro `db:start` baixa o stack oficial e aplica migrations. O modo reduzido mantém **um único PostgreSQL**, além de Auth, API, gateway, painel e e-mail de teste. Ao alterar `supabase/config.toml`, execute `npm run db:stop` e `npm run db:start`. `db:reset` **apaga dados somente deste banco Supabase local**; não use com dados que precise preservar. O Compose só manipula o projeto `herbamed-carreiras-local`, sem desligar outros containers desta máquina.

## Configuração

`.env.example` descreve o ambiente local. Para Vercel, use [`.env.vercel.example`](.env.vercel.example) somente como lista de variáveis: `SUPABASE_ANON_KEY` recebe a chave publishable e `SUPABASE_SERVICE_ROLE_KEY` recebe a secret, apenas no servidor. A `DATABASE_URL` é exclusiva do worker histórico, desativado na nuvem. O fluxo atual de currículo e PDF usa a sessão da pessoa e RLS; as rotas antigas de Storage retornam 410 por padrão. Não inclua segredos em `NEXT_PUBLIC_*`.

Para a primeira demonstração hospedada, crie um projeto Supabase novo e configure Auth Azure/Entra com tenant corporativo, SMTP e Turnstile. A Vercel usa o build nativo do Next.js; a instalação Docker local continua independente. Não execute `supabase/seed.sql` na nuvem. Aplique migrations antes do deploy; veja o [passo a passo completo](docs/DEPLOYMENT.md), inclusive o limite do plano Hobby da Vercel para uso corporativo.

## Estado atual

As páginas e os fluxos principais foram implementados e o build e RLS passam. A [matriz de entrega](docs/STATUS.md) distingue o que foi exercitado de integrações que ainda precisam de configuração real antes da produção. O aviso de privacidade semeado é **exclusivo de teste**, e candidaturas reais exigem aviso jurídico aprovado.

## Solução de problemas

- **Docker Desktop não responde:** confirme `docker desktop status` e `docker info`. Não apague volumes nem use factory reset: isso afetaria outros projetos locais.
- **Portal sem vagas:** verifique `npm run db:start`, `.env.local`, `docker compose ps` e `docker compose logs app`.
- **RH recebe acesso restrito:** primeiro entre com a conta de demonstração, depois conclua TOTP em `/seguranca`. Em cloud, confirme Entra ID e a atribuição de perfil.
- **Candidatura bloqueada:** abra Meu currículo → Revisar e exportar e complete os itens listados. O formulário da vaga aparecerá quando os dados essenciais estiverem preenchidos.
- **Chaves locais renovadas:** execute `npm run local:setup`, depois `docker compose up -d --build` para recompilar a chave pública embutida no navegador.
