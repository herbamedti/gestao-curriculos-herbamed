# Convites da equipe e cadastros administrativos

## Uso

O administrador principal, com autenticador confirmado, acessa **Administração → Usuários** (`/rh/usuarios`). A tabela tem busca, filtro de situação e páginas de 20 registros. **Convidar usuário** abre um modal com Dados, Permissões e Segurança. Não se define senha na criação.

- **Dados:** nome, e-mail e perfil. Na edição, o e-mail fica somente para consulta; o titular altera seu endereço na Conta com a verificação de identidade existente.
- **Permissões:** regras por tela e ação. Herdar usa o perfil; Permitir e Bloquear são exceções individuais. Editar/publicar/exportar exige também visualizar a respectiva seção. Banco de talentos tem permissão própria e continua exigindo leitura de candidatos, pois compartilha os dados dos currículos. O escopo de vagas atribuídas do perfil continua obrigatório.
- **Segurança:** acesso ativo e checkbox de exigência de duas etapas. Desativar bloqueia a conta e revoga as sessões anteriores; reativar exige novo login. Contas pendentes permitem reenviar o convite. Contas com primeiro acesso concluído permitem a redefinição administrativa da senha, com revogação de sessões.

Gerenciar acessos e editar perfis permanecem exclusivos do principal em AAL2, inclusive quando outra pessoa recebe o perfil Superadministrador. O próprio principal usa **Configurações → Conta** para alterar seus dados.

A interface acompanha essas regras: ações de criação de vaga, edição/publicação de vaga, movimentação de candidaturas, avaliações, agendamento, envio de mensagens e exportação CSV são ocultadas quando não autorizadas. A vaga permanece disponível em modo de consulta. Página, RPC e RLS continuam verificando acesso independentemente da interface.

## Convite e primeiro acesso

1. O servidor valida o JWT do principal, o perfil, os campos e a quota (20 convites por hora por principal).
2. Reserva uma autorização privada de criação por e-mail, válida por dez minutos e consumida uma única vez pelo hook Before User Created. O cadastro público de candidatos mantém CPF, nascimento, validações e quotas.
3. O Auth gera o convite. O servidor grava o perfil e o estado pendente em uma transação. A mensagem segue pelo mesmo provedor configurado para a plataforma: Microsoft Graph em produção ou SMTP/Mailpit local.
4. O link abre `/auth/confirm`. Um GET não confirma nem consome o token, permitindo a inspeção de links por filtros de e-mail. O destinatário clica em **Confirmar e continuar**, confirma a propriedade do e-mail e vai a `/primeiro-acesso`.
5. A senha exige 12–128 caracteres, maiúsculas, minúsculas, números, símbolo e confirmação. O servidor verifica a sessão do titular, salva a senha pelo Auth e conclui o acesso. Depois encerra a sessão do convite e direciona ao login. MFA é exigida no login quando marcada.

Antes de concluir o primeiro acesso, a conta não acessa gestão nem dados de candidatos, mesmo por RPC/API. Tokens de convite não são guardados nas tabelas de domínio nem registrados nos logs. O ticket de criação é removido do metadata após o provisionamento.

Falhas de entrega preservam o cadastro pendente e aparecem na tabela. Corrija o provedor e use **Segurança → Reenviar convite**. O reenvio exige conta ativa e intervalo mínimo de um minuto. Se o e-mail já foi confirmado e a senha ainda não foi definida, o reenvio usa recuperação, mantendo a mesma exigência de primeiro acesso. A operação não transforma uma conta de candidato existente em usuário interno; e-mails já cadastrados são recusados.

## Configurações e currículo

`/rh/configuracoes` apresenta departamentos, áreas de interesse, tags, pools de talentos, níveis de experiência e tipos de emprego em tabelas selecionáveis, com busca, filtro, paginação e ações por ícone. Criação/edição/exclusão abrem modais. Excluir um item em uso continua bloqueado; desativar preserva seus vínculos históricos. `settings.read` permite consultar; `settings.manage` permite alterar. A tela de privacidade também distingue `privacy.read` de `privacy.manage`.

As seções de trajetória do currículo usam um card por linha em todos os tamanhos de tela, tanto no cadastro/edição do candidato quanto no cadastro/edição do RH.

## Publicação

Aplicar estas migrations, na ordem, **antes do deploy do código** no Supabase hospedado:

1. `supabase/migrations/202610080001_staff_invites_and_permissions.sql`
2. `supabase/migrations/202610080002_staff_invitation_signup_guard.sql`
3. `supabase/migrations/202610080003_talent_screen_permission.sql`

Não executar seed ou reset na nuvem. As migrations preservam as contas atuais e concedem as novas permissões de leitura aos perfis que já acessavam cada seção. O hook continua apontando para `public.guard_candidate_signup`; não mudar sua configuração.

Não há variáveis novas. Para enviar convites na Vercel, manter `ENABLE_EMAIL=true`, `APP_URL` no domínio público final e o provedor já configurado (`EMAIL_PROVIDER=microsoft_graph` com as quatro variáveis `MS_GRAPH_*`, ou SMTP). Os segredos permanecem somente no servidor. O link de login usa `/entrar?perfil=rh`. O ambiente local continua separado em `.env.local`, com Mailpit.

## Verificação local

`npm run check`, `npm run test:db`, `npm run db:types`, `npm run test:e2e:registration` e `node scripts/smoke-curriculum-fields.mjs`. Os smokes usam somente Supabase/PostgreSQL locais e contas fictícias. O smoke de administração envia exclusivamente para Mailpit local e restaura o principal anterior na limpeza.
