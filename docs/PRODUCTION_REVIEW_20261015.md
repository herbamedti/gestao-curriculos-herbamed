# Revisão de acesso e publicação — 15/10/2026

## Mudanças

- Links compartilhados sublinham somente os rótulos; ícones e indicadores de carregamento ficam sem sublinhado. Links externos de texto preservam o hover.
- Login sem as duas explicações removidas a pedido; identificação no primeiro acesso Google permanece obrigatória no servidor.
- E-mails normalizados e consulta de existência exclusivamente pelo servidor, após quotas. Contas novas e existentes recebem a mesma mensagem e destino. Duplicatas confirmadas ou pendentes não provocam nova chamada `signUp`, troca de senha/identificação ou novo envio. A unicidade final continua no Auth. A nova consulta não é concedida a `anon`/`authenticated`.
- Resposta genérica conforme [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). Isso não garante tempo constante: latências do Auth/provedor ainda variam; manter quotas e proteção de borda.
- Recuperação pela aplicação exige autorização de uso único por dez minutos, vinculada ao titular e à sessão. Somente confirmação por POST do token `recovery`/`invite` emite autorização; login e parâmetros `next` não emitem. Cookie HttpOnly/SameSite Strict, somente hash no banco privado com RLS. Falha ao salvar consome autorização: solicitar outro link.
- Usar os templates com `token_hash`/`type` e `/auth/confirm` já documentados e usados pelo hook de e-mail. Callback PKCE genérico não comprova recuperação e não autoriza a ação de senha.
- Cadastro público com e-mail desativado é recusado em `APP_ENV=production`; modo sem confirmação permanece em demonstração/local. Não apontar `.env` local ao banco de produção.
- Next.js 16.3.6 atualizado para 16.3.8, com eslint-config-next correspondente. Seis avisos conhecidos incluíam [SSRF na otimização de imagens](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4). A aplicação não configura imagens remotas, condição necessária para esse SSRF, mas a atualização cobre também os demais avisos. Auditoria de produção após atualização: zero avisos conhecidos. A cadeia de desenvolvimento ESLint ainda exige atualização separada.

## Evidências e limites

Consulta somente de leitura ao Auth hospedado confirmou: confirmação de e-mail ativa, senha e Google habilitados; Azure desabilitado. Nenhuma configuração ou dado de produção foi alterado nesta revisão.

O advisor hospedado retornou 70 avisos: sete funções SECURITY DEFINER executáveis por anônimos, 62 por autenticados e proteção de senhas vazadas desativada. Os dois primeiros grupos incluem auxiliares de RLS e RPCs intencionalmente expostas. O aviso de EXECUTE não demonstra, isoladamente, ausência de autorização. Não revogar esses grupos indiscriminadamente: páginas públicas e operações autorizadas dependem deles. Conferir guardas e testes de isolamento.

Avaliar proteção contra senhas vazadas no painel: depende de [Supabase Pro ou superior](https://supabase.com/docs/guides/auth/password-security). Não foi habilitada automaticamente nem houve alteração de assinatura.

**Limitação ainda aberta:** a API direta do Supabase Auth permite ao titular autenticado mudar suas próprias credenciais segundo as regras nativas. A autorização extra da aplicação não restringe esse endpoint. Caso seja exigido segundo fator obrigatório para toda alteração de senha, resolver com gateway de Auth ou provedor com step-up obrigatório antes de aprovar produção. RLS e MFA de acesso às funções internas continuam ativos. Ver também `SECURITY.md`.

Manter Before User Created, Send Email Hook, confirmação dupla de mudança de e-mail, MFA da conta principal, rate limits de Auth/WAF, URLs restritas e segredos somente no servidor. CPF com dígitos válidos não comprova titularidade. Esta revisão não equivale a pentest ou garantia de ausência de falhas.

## Conta corporativa e orçamento

Preferir o time corporativo responsável pelo produto. [Hobby admite uso pessoal não comercial](https://vercel.com/docs/plans/hobby); não é adequado como plano definitivo deste portal empresarial.

Se o time já for Pro, o mesmo assento pago pode publicar ambos os projetos. Base atual: US$20/mês, um assento e US$20 em crédito de uso compartilhado; outro assento de publicação acrescenta US$20/mês. Excedente, adicionais e impostos são separados. Candidatos e RH não são assentos Vercel. [Condições Pro](https://vercel.com/docs/plans/pro-plan).

Sem conhecer assinatura e acessos, isso é cenário, não confirmação de fatura. Verificar Settings → Billing, Members e Usage no time corporativo; configurar alertas e ações de gasto. Alerta sozinho não é teto de cobrança. Supabase tem cobrança independente: Free dentro dos limites ou [Pro a partir de US$25/mês](https://supabase.com/pricing).

## Transferência e publicação

É possível [transferir o projeto existente](https://vercel.com/docs/projects/transferring-projects) em Settings → General → Transfer Project, com os acessos necessários nos dois times. Configurações, variáveis do painel, repositório e domínios acompanham; integrações precisam ser conferidas/reinstaladas. Não é necessário recriar o banco Supabase.

Antes do deploy desta versão:

1. Aplicar `supabase/migrations/202610150001_signup_and_recovery_guards.sql` primeiro no Supabase de teste e validar os fluxos antes do banco hospedado final. Nunca reset/seed em produção.
2. Executar testes de banco e jornadas de cadastro, confirmação, recuperação, convite e permissões. Resolver a decisão sobre a limitação de credenciais acima com o responsável pela segurança.
3. Definir `APP_ENV=production`, `ENABLE_EMAIL=true` e `APP_URL` HTTPS canônica. Conferir Graph/hook e Turnstile/WAF conforme configuração aprovada. Nenhuma variável nova foi criada.
4. Se mudar domínio, ajustar Site URL/redirects Supabase, origens Google e URL do Send Email Hook. No Google o redirect OAuth é o callback Supabase `/auth/v1/callback`; retorno à aplicação é configurado no Supabase. Remover URLs de teste da allowlist final.
5. Conferir conexão Git, variáveis Production/Preview e acesso público em janela anônima sem login Vercel; testar cadastro, recuperação e exportação com conta autorizada.

## Validação desta entrega

Lint, TypeScript e build passaram com Next.js 16.3.8. Os 56 testes Vitest passaram, incluindo execução da migration nova em PostgreSQL embarcado (PGlite) para ACL, RLS, duplicatas pendentes/confirmadas, vinculação à sessão, expiração e consumo único.

Playwright conferiu a tela real de login em desktop/mobile, ausência dos textos e preservação do Google. O hover foi conferido com o componente Link renderizado sob o CSS real: ícones sem sublinhado e rótulos, nomes em negrito e links externos preservados. Não confundir essa verificação isolada com navegação autenticada integrada.

Na primeira tentativa Docker estava indisponível. Na correção subsequente de separação de áreas, o ambiente voltou a funcionar: `npm run test:db` passou com 433 verificações, `npm run db:types` regenerou os tipos e os smokes ampliados de cadastro/administração e e-mail/recuperação passaram. A revisão de áreas também foi validada no navegador; detalhes em `ACCOUNT_AREA_ROUTING.md`. Isso resolve a pendência local de integração, sem constituir validação no domínio hospedado.

Nenhum deploy, transferência, migração hospedada ou contratação foi executado.
