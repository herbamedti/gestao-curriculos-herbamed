# Publicar a demonstração: Vercel + Supabase

Este roteiro mantém **dois bancos independentes**. `npm run local:start` usa o Supabase CLI/Docker e os dados fictícios do computador. A Vercel usa um projeto Supabase hospedado novo, identificado por `https://<project-ref>.supabase.co`. Nenhuma etapa abaixo copia o banco, as senhas ou o `.env` local para a nuvem.

**Plano e finalidade.** O [Hobby da Vercel](https://vercel.com/docs/plans/hobby) permite apenas uso pessoal e não comercial. Como esta é uma aplicação da Herbamed, use Pro ou, se a conta for elegível, o [trial Pro](https://vercel.com/docs/plans/pro-plan/trials) para a demonstração inicial. O trial não oferece hospedagem gratuita permanente. Supabase Free e [Turnstile Free](https://developers.cloudflare.com/turnstile/plans/) podem servir à demonstração, respeitados seus limites. Até a revisão de segurança e privacidade descrita ao final, use somente **contas e currículos fictícios** na nuvem e `APP_ENV=demo`.

## 1. Preparar e versionar o código

No PowerShell, a partir de `C:\projetos\gestao-curriculos-herbamed`:

```powershell
npm ci
npm run check
npm run test:db
git status --short
git remote -v
```

Use o repositório Git **privado** e confira `git status --short` e `git check-ignore .env .env.local` antes de enviar alterações; ambos os arquivos de ambiente devem permanecer ignorados. Não envie currículos, tokens, chaves, logs ou dados reais. A Vercel [importa o repositório Git](https://vercel.com/docs/git) e reconhece o Next.js; use a raiz do repositório, `npm ci` e `npm run build`. O `Dockerfile.vercel` histórico foi preservado em `docs/legacy/` porque a [presença dele na raiz ativaria automaticamente o deploy por contêiner](https://vercel.com/docs/functions/container-images), causando conflito com o preset Next.js. O Dockerfile e o Compose da raiz continuam para uso local.

Se ainda precisar criar um remoto vazio, sem README inicial, e depois de revisar os arquivos que serão incluídos:

```powershell
git add .
git diff --cached --name-only
git diff --cached --check
git commit -m "Preparar demonstracao Vercel e Supabase"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Troque a URL do `origin` pela do repositório privado criado. Se já existir um `origin`, não repita `git remote add`; confira `git remote -v` primeiro.

## 2. Criar o Supabase hospedado

1. Crie um projeto **novo** no [Supabase Dashboard](https://supabase.com/dashboard), escolha a região e guarde a senha do banco fora do Git. Anote o **Project ref** em *Project Settings → General*.
2. Em *Project Settings → API Keys*, copie a **Project URL**, uma chave **publishable** (`sb_publishable_…`) e uma chave **secret** (`sb_secret_…`). Os nomes das variáveis do código ainda são `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` por compatibilidade; coloque nelas, respectivamente, esses valores novos. A [chave secret contorna RLS](https://supabase.com/docs/guides/getting-started/api-keys) e deve ficar somente no ambiente de servidor da Vercel. Não use a chave local do CLI.
3. Vincule o CLI ao projeto novo e aplique **somente migrations**. Faça isso uma vez por versão, antes do deploy da aplicação:

```powershell
cd C:\projetos\gestao-curriculos-herbamed
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

O CLI poderá pedir a senha do banco. Revise a lista do `--dry-run` antes de confirmar. **Nunca execute** `db reset --linked`, `db push --include-seed` ou `supabase/seed.sql` no projeto hospedado: o seed contém usuários e aviso fictícios, exclusivos do Docker local. O comando `db push` padrão aplica migrations pendentes sem seed, como documentado pelo [Supabase](https://supabase.com/docs/guides/local-development/cli-workflows). Alterações posteriores de schema devem entrar em migrations novas.

4. Em *Authentication → URL Configuration*, defina **Site URL** como `https://SEU-PROJETO.vercel.app` (ou domínio próprio definitivo). Adicione exatamente estes **Redirect URLs**:

```text
https://SEU-PROJETO.vercel.app/auth/callback
https://SEU-PROJETO.vercel.app/auth/callback?next=/rh
https://SEU-PROJETO.vercel.app/auth/callback?next=/nova-senha
```

Esses três caminhos correspondem ao cadastro, Microsoft e recuperação de senha do código. Confira o [guia de redirects](https://supabase.com/docs/guides/auth/redirect-urls). O `supabase/config.toml` define o **ambiente local**; `db push` não substitui a configuração de Auth hospedada.

5. Em *Authentication → Providers → Email*, habilite Email, confirmação de cadastro, confirmação nos endereços antigo **e** novo ao alterar e-mail e proteção de alteração de senha. Habilite TOTP em MFA se aparecer como opção; a [API TOTP é gratuita](https://supabase.com/docs/guides/auth/auth-mfa/totp). Não desligue essas proteções para facilitar o teste.

## 3. Configurar envio de e-mail

O SMTP inicial do Supabase só envia para integrantes do projeto e tem limite baixo; cadastros de candidatos exigem [SMTP personalizado](https://supabase.com/docs/guides/auth/auth-smtp). Escolha um provedor SMTP, verifique o domínio/remetente e obtenha host, porta, usuário e senha. Configure as **mesmas credenciais** em dois lugares:

- *Supabase → Authentication → SMTP Settings*: para confirmação de cadastro, recuperação e mudança de e-mail.
- *Vercel → Project Settings → Environment Variables*: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: para o código de Conta enviado pela aplicação.

Em geral, porta 587 usa `SMTP_SECURE=false` (STARTTLS) e porta 465 usa `true`; confirme com o provedor. Use um remetente verificado, por exemplo `Herbamed Carreiras <no-reply@seu-dominio>`. Cadastre-o também no Supabase. As mensagens de fila operacional (`private.outbox`) **não** são enviadas neste deploy: o worker histórico continua desativado; não anuncie notificações por e-mail como ativas. Notificações em tela funcionam separadamente.

## 4. Criar o Turnstile

No [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/), crie um widget para o **hostname exato** da Vercel ou do domínio próprio. Copie a *site key* e a *secret key*. O formulário mostra a site key e o servidor valida a resposta com a secret key e o hostname de `APP_URL`. Cadastros, login e recuperação em cloud não passam sem essa configuração. Ao mudar o domínio, atualize o widget, `APP_URL`, os redirects do Supabase e faça novo deploy.

## 5. Importar na Vercel e cadastrar variáveis

Em *Vercel → Add New → Project*, importe o repositório privado. Selecione **Next.js** e raiz `./`. Em *Build and Output Settings*, sobrescreva apenas **Build Command** com `npm run build` e **Install Command** com `npm ci`; mantenha **Output Directory** no padrão do Next.js. O build explícito executa também a validação de ambiente definida no `package.json`. Escolha um nome de projeto e use o domínio estável `https://SEU-PROJETO.vercel.app` como `APP_URL`. Se a URL final for diferente, corrija `APP_URL` e os redirects antes de testar Auth. Selecione **Node.js 24.x** nas configurações do projeto. Se a tela de importação ainda mostrar *Possible configuration mismatch* depois de o commit que arquiva `Dockerfile.vercel` chegar ao GitHub, atualize a página de importação.

Cadastre estas variáveis no escopo **Production**. O [modelo sem valores reais](../.env.vercel.example) está no repositório. No painel da Vercel, insira apenas o **valor** de cada uma, sem copiar comentários nem `=`. Não copie `.env` ou `.env.local` do computador.

| Variável | Valor / origem | Exposição |
| --- | --- | --- |
| `APP_ENV` | `demo` para esta primeira publicação; `production` só após os bloqueios finais resolvidos | Servidor |
| `APP_NAME` | `Herbamed Carreiras` | Servidor |
| `APP_URL` | URL HTTPS **exata** e estável da publicação, sem `/` final | Servidor |
| `SUPABASE_URL` | Project URL do Supabase hospedado | Servidor |
| `SUPABASE_ANON_KEY` | Chave **publishable** desse projeto | Servidor; pode ser pública, mas não precisa de `NEXT_PUBLIC_` no fluxo atual |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave **secret** do mesmo projeto | **Segredo apenas servidor**; nunca use `NEXT_PUBLIC_` |
| `TURNSTILE_SITE_KEY` | Site key do widget para o hostname de `APP_URL` | Chave pública renderizada no formulário |
| `TURNSTILE_SECRET_KEY` | Secret key do mesmo widget | Segredo apenas servidor |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Endereço, porta e TLS conforme o provedor | Servidor |
| `SMTP_USER` / `SMTP_PASSWORD` | Credenciais SMTP | Segredos apenas servidor |
| `SMTP_FROM` | Remetente verificado, no formato `Nome <endereco@dominio>` | Servidor |
| `ENABLE_LEGACY_STORAGE_UPLOADS` | `false` | Servidor |

O build recusa variáveis obrigatórias ausentes, URLs locais e upload legado ativado. **Não configure** `DATABASE_URL`, `AZURE_CLIENT_ID`, `AZURE_SECRET`, `CLAMAV_HOST`, `SIGNED_URL_TTL_SECONDS` ou `NEXT_PUBLIC_SUPABASE_*` na Vercel para o fluxo atual. `DATABASE_URL` é usado apenas pelo worker histórico local. O cliente de autenticação da aplicação roda no servidor e recebe a chave publishable por `SUPABASE_ANON_KEY`. As chaves Microsoft pertencem à configuração do provedor Azure no Supabase, não ao Next.js.

Evite associar o **mesmo projeto Supabase de Production** às Preview Deployments: elas usam outra URL e poderiam misturar dados. Deixe Preview sem estas variáveis, com build bloqueado, até haver um projeto Supabase de staging, Turnstile e URLs próprios. Depois de salvar variáveis, acione **Deploy/Redeploy**; mudanças de ambiente não alteram deployments já criados.

## 6. Acesso do gestor e conteúdo inicial

O projeto hospedado começa **sem usuários, vagas, candidatos ou aviso de privacidade**. Para liberar o primeiro gestor, configure o provedor [Azure/Microsoft no Supabase](https://supabase.com/docs/guides/auth/social-login/auth-azure): registre uma aplicação Web no Microsoft Entra ID da organização, com redirect URI `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`; copie Client ID e **valor** do Client Secret para *Supabase → Authentication → Providers → Azure*. Informe a **Tenant URL** `https://login.microsoftonline.com/SEU_TENANT_ID` para limitar o diretório. O código já solicita escopo `email`.

1. A pessoa gestora entra uma vez pelo botão **Entrar com Microsoft**. O primeiro acesso termina em acesso negado, pois ainda não existe vínculo de RH. Isso cria o usuário Azure no Auth hospedado.
2. No *Supabase → SQL Editor* (sessão administrativa do projeto), execute **uma vez**, usando o e-mail Microsoft **confirmado** dessa pessoa:

```sql
select private.bootstrap_first_staff('gestor@seu-dominio', 'Nome da pessoa gestora');
```

Use o e-mail real apenas no painel protegido, **nunca** no arquivo SQL do Git. A função só aceita usuário Azure confirmado, exige que ainda não haja staff e vincula `Superadministrador`. Ela não é executável pelas chaves da API. Saia e entre novamente; conclua o cadastro TOTP em `/seguranca` para atingir AAL2. Se a organização não puder configurar Entra ID, o RH hospedado permanece indisponível; não habilite a exceção de senha do seed local.

3. Em **RH → Solicitações LGPD**, publique o texto/versionamento **aprovado** pela Herbamed. Nenhum aviso fictício é publicado na nuvem; sem aviso ativo, candidatura fica bloqueada. Em **RH → Configurações**, cadastre áreas e departamentos necessários e então crie uma vaga de teste. Cadastre somente pessoas e currículos fictícios nesta fase.

## 7. Conferir a publicação

Após o deploy, abra `https://SEU-PROJETO.vercel.app/api/health`: deve responder `{"status":"ok"}`. Se retornar 503, confirme migrations, URL e chave publishable do Supabase e veja *Vercel → Logs*. Teste cadastro fictício e confirmação por e-mail, login, currículo estruturado e PDF; depois candidatura com currículo completo e aviso ativo. Teste o RH com Microsoft/TOTP, candidatura vinculada, edição e PDF. Os dados locais **não** devem aparecer na nuvem e os dados hospedados **não** devem aparecer em `localhost:3000`.

Para publicar mudanças futuras: teste localmente, crie migrations novas quando houver schema, revise `npx supabase db push --dry-run`, aplique `npx supabase db push` ao projeto correto e só então envie o commit que dispara o deploy da Vercel. Mantenha `APP_URL`, redirects, Turnstile e domínio de e-mail sincronizados. No plano Free, o [Supabase pode pausar](https://supabase.com/docs/guides/platform/free-project-pausing) projetos de baixa atividade; abra o Dashboard e use **Resume project** quando necessário. Não conte com isso como disponibilidade contínua para candidatos reais.

## Ambiente local preservado e limite da demonstração

Use `npm run local:start` para manter o site em `http://localhost:3000` com banco e Mailpit locais. Depois da primeira configuração, `docker compose up -d --build` recompila só a aplicação local. `npm run db:stop` para o Supabase local sem apagar seus dados; `db:reset` **apaga** apenas o banco local. Não rode `vercel env pull` nem coloque credenciais hospedadas em `.env` ou `.env.local` deste checkout. `npx supabase link` grava o vínculo remoto sob `supabase/.temp/` (ignorado); antes de `db push`, confirme o Project ref indicado pelo CLI.

Esta publicação é uma **demonstração técnica**, não liberação para currículos reais. O fluxo de Conta exige segundo fator dentro da aplicação, mas chamadas diretas a `Supabase Auth.updateUser` ainda podem contornar essa tela; veja [Segurança](SECURITY.md). Também faltam validação jurídica de aviso, base e retenção, verificação de acessibilidade/carga e operação de backup/alertas. `APP_ENV=demo` exibe o aviso de dados fictícios e impede indexação; a configuração `production` só deve ser usada depois dessas correções e verificações.
