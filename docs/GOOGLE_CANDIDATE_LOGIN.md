# Login Google para candidatos

O portal usa OAuth do Supabase com PKCE e os escopos `openid email profile`. O Google autentica a conta e informa seu e-mail verificado; a aplicação não recebe nem armazena a senha Google. CPF e nascimento continuam obrigatórios para liberar o candidato. A validação de CPF confere formato e dígitos, não titularidade ou situação cadastral na Receita.

## Fluxo e permissões

1. Em `/entrar` ou `/criar-conta`, o candidato escolhe **Continuar com Google**.
2. O Google retorna ao Supabase, que retorna à aplicação. A troca do código exige o verificador PKCE guardado em cookie HttpOnly. O e-mail já vem verificado pelo Google; esse cadastro não precisa de uma segunda confirmação enviada pelo Microsoft Graph.
3. Se faltar identificação, a aplicação mostra `/completar-cadastro` e exige CPF válido e nascimento válido, sem datas futuras. O e-mail vem da sessão autenticada, sem campo editável nesse formulário.
4. A conta Auth já existe nesse ponto, mas ainda não tem acesso ao currículo, candidatura, exportação pessoal ou área interna. Página, RPC e RLS bloqueiam o acesso enquanto faltar identificação.
5. A conclusão usa somente `auth.uid()`, exige identidade Google com e-mail verificado e armazena a identificação no schema privado. CPF/nascimento não entram no metadata nem no JWT. Não cria perfil de equipe e não sobrescreve identificação anterior.

O Supabase pode vincular automaticamente a identidade Google a uma conta existente com o mesmo e-mail verificado. Nesse caso, a identificação e o currículo anteriores são preservados. A escolha do banco de talentos continua sendo explícita e o currículo ainda precisa conter os dados essenciais antes da candidatura.

Google é um método para candidatos. O retorno Google de uma conta de equipe encerra essa sessão. O banco também recusa a autorização interna por OAuth de contas vinculadas ao Google, mesmo se o metadata legado ainda disser `email` e a sessão tiver AAL2. Como o AMR do Supabase identifica OAuth sem distinguir todos os provedores, essa restrição também abrange outros logins OAuth de uma conta interna que tenha sido vinculada ao Google. O acesso interno por senha autorizada continua com suas regras de MFA/RBAC. Use o método interno habitual para a equipe e reserve Google aos candidatos.

Desvincular a identidade Google não remove a obrigação pendente de identificação. Moderação de contas e revogação de sessões continuam valendo. Há quotas privadas para início OAuth (10/minuto, 30/hora por origem), novas contas Google (5/hora por origem no Auth Hook) e conclusão de identificação (10/hora por conta); origem não confiável usa uma chave compartilhada, sem confiar em cabeçalhos arbitrários fora da Vercel. O CAPTCHA existente continua sendo exigido quando habilitado.

## Publicação no Supabase e na Vercel

Faça nesta ordem, sobre as migrations anteriores já aplicadas:

1. Aplique `supabase/migrations/202610070003_google_candidate_login.sql` no Supabase hospedado. É uma migration nova, sem seeds e sem redefinir contas existentes. Se usar SQL Editor, execute o arquivo completo em uma transação (`BEGIN;` antes e `COMMIT;` depois) e interrompa se houver erro. Não execute novamente se já estiver aplicada. O ambiente local já recebeu essa migration.
2. Em **Supabase → Authentication → Hooks**, mantenha **Before User Created** usando a função PostgreSQL `public.guard_candidate_signup`. A migration atualiza essa mesma função para admitir Google verificado com limite de cadastros, mantendo a proteção do cadastro por e-mail. Não remova o hook de envio Microsoft Graph que já está configurado: ele continua atendendo o cadastro por e-mail e os demais fluxos de e-mail.
3. Em **Authentication → Sign In / Providers → Google**, mantenha o provedor ativo e informe Client ID/Client Secret somente nesse painel. Mantenha **Skip nonce checks** e **Allow users without an email** desativados. Copie a **Callback URL (for OAuth)** exibida pelo Supabase.
4. Em **Google Cloud → Google Auth Platform → Clientes → seu cliente Web**, substitua a URI de redirecionamento do print pela callback copiada do Supabase, no formato `https://SEU-PROJETO.supabase.co/auth/v1/callback`. A URI da Vercel `/auth/callback` não deve ocupar esse campo do Google. A origem JavaScript pode continuar `https://gestao-curriculos-herbamed.vercel.app`, sem caminho e sem barra final.
5. Em **Supabase → Authentication → URL Configuration**, configure:

   | Campo | Valor |
   | --- | --- |
   | Site URL | `https://gestao-curriculos-herbamed.vercel.app` |
   | Redirect URLs | `https://gestao-curriculos-herbamed.vercel.app/auth/callback` |
   | Redirect URLs (adicional para Google) | `https://gestao-curriculos-herbamed.vercel.app/auth/callback?provider=google` |

   Preserve também os endereços de recuperação já configurados. Se usar outro domínio final, substitua os três valores e a origem Google. Evite curingas amplos para produção; abra o domínio canônico desde o início do login para o cookie PKCE ficar no mesmo domínio do retorno. Um deploy temporário da Vercel não compartilha cookies com o domínio final.
6. No Google, confira **Público-alvo**. Se o app externo ainda estiver em teste, inclua as contas de teste autorizadas; para candidatos externos, a configuração precisa permitir esse público conforme as exigências exibidas pelo Google. Confira nome, e-mail de suporte, domínio e links de privacidade da tela de consentimento. Não solicite permissões Gmail/Drive: o software precisa apenas dos escopos de identificação acima.
7. Na **Vercel → Project → Settings → Environment Variables**, defina em Production:

   | Variável | Valor |
   | --- | --- |
   | `ENABLE_GOOGLE_LOGIN` | `true` |
   | `APP_URL` | `https://gestao-curriculos-herbamed.vercel.app` |

   Preserve as variáveis Supabase/Graph existentes. Não há `GOOGLE_CLIENT_SECRET` na Vercel; o segredo pertence ao provedor no Supabase. Publique o código e faça novo deploy depois de salvar as variáveis. O botão só aparece quando `ENABLE_GOOGLE_LOGIN=true`; sem a variável ele permanece desligado.
8. Teste pelo domínio final em uma janela anônima: Google → CPF/nascimento → área do candidato. Teste CPF inválido/data futura, sair/entrar novamente, conta com cadastro anterior e conta desativada. A segunda entrada de uma conta já identificada não deve pedir os dados de novo. Confirme que o login Google não permite administrar RH.

## Ambiente local

Os arquivos privados de ambiente e as credenciais existentes não foram alterados. Google fica desativado localmente por padrão; o login por senha e o envio local continuam funcionando. Para testar Google real localmente, use preferencialmente um cliente Google separado de desenvolvimento e habilite o provedor no Supabase **local**, com credenciais privadas. No cliente Google, use a callback local mostrada pelo Supabase (`http://127.0.0.1:54321/auth/v1/callback` no padrão do projeto). No Supabase local, autorize os retornos da aplicação em `http://localhost:3000/auth/callback` e `http://localhost:3000/auth/callback?provider=google`. Use `APP_URL=http://localhost:3000` e `ENABLE_GOOGLE_LOGIN=true` somente no ambiente local. Não aponte o banco local ao projeto hospedado para facilitar o teste.

Para retirar o botão temporariamente, use `ENABLE_GOOGLE_LOGIN=false` e reinicie/republique a aplicação. Isso controla a apresentação e o início do fluxo pela aplicação; para impedir também novos logins iniciados diretamente no Auth, desative o provedor no Supabase. As proteções de identificação de contas já criadas continuam ativas no banco.

## Validação

`npm run check`, `npm run test:db` e `npm run db:types` verificam a implementação e o schema. `npm run test:e2e:google`, após build, usa somente dados fictícios locais, testa o início OAuth/PKCE e interrompe antes do provedor externo. Uma identidade Google local de teste verifica conclusão obrigatória, dados inválidos, acesso direto bloqueado, identificação privada e layout desktop/mobile. Esse smoke não comprova autenticação real no Google: o fluxo externo exige a configuração e o teste hospedado descritos acima. As fixtures e o servidor temporário são removidos ao terminar; screenshots ficam em `artifacts/`, fora do Git.

Referências: [Google com Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [vínculo de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking), [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).

O botão segue a [identidade oficial Google](https://developers.google.com/identity/branding-guidelines), com o ícone obtido dessa página e Google Sans Medium em WOFF2 latino, servido localmente. A licença SIL OFL da fonte acompanha o arquivo em `public/fonts/GoogleSans-OFL.txt`; a fonte afeta somente esse botão.
