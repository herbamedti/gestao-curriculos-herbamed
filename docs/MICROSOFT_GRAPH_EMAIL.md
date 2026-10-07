# Envio de e-mail pelo Microsoft Graph

Para ativar o envio no cadastro com CPF, nascimento, limites e criação da equipe, siga também `REGISTRATION_AND_STAFF_ADMIN.md`. Essa versão exige a nova migration e o hook PostgreSQL **Before User Created**, além do Send Email Hook HTTP descrito aqui.

O servidor Next.js envia por uma caixa do Exchange Online com OAuth `client_credentials`. O Supabase continua responsável pelos usuários, tokens e confirmação do cadastro. Seu Send Email Hook chama `POST /api/auth/send-email`, que verifica a assinatura Standard Webhooks, valida o corpo com Zod e encaminha as mensagens pelo mesmo serviço usado pela Conta. Não é preciso manter uma sessão do Outlook aberta. Não há permissões de leitura de mensagens nem mudanças em MFA/RBAC dos usuários.

## 1. Registrar a aplicação no Entra

No [Microsoft Entra](https://entra.microsoft.com/), na organização correta:

1. Abra **Registros de aplicativos → Novo registro**.
2. Nome: `Herbamed Carreiras - Envio de e-mails`.
3. Selecione **Somente contas deste diretório organizacional** (single tenant).
4. Deixe a URI de redirecionamento vazia: este registro é para envio automático, não para login interativo.
5. Anote **ID do aplicativo (cliente)** e **ID do diretório (locatário)**.
6. Em **Certificados e segredos → Segredos do cliente**, crie uma credencial e guarde o **valor**, não o ID. Esta versão usa client secret. Mantenha a validade registrada e renove a credencial no Entra e na Vercel antes de vencer; certificado/federação não estão implementados.
7. Em **Aplicativos empresariais**, localize a aplicação pelo Client ID e anote seu **ID do objeto**. Ele é o Object ID do service principal, diferente do Object ID mostrado em Registros de aplicativos.

Use um registro próprio para envio, separado do provedor Azure de login do Supabase. Os nomes `AZURE_CLIENT_ID`/`AZURE_SECRET` da configuração histórica de login não são usados para enviar.

## 2. Autorizar somente a caixa remetente no Exchange

Um administrador com as permissões de Exchange necessárias deve configurar **RBAC for Applications**. A caixa deve existir no Exchange Online; um alias sozinho não é uma caixa. Uma caixa compartilhada pode ser utilizada, respeitando as condições de licenciamento da organização.

Os comandos abaixo são um modelo para o administrador adaptar. Os dados são fictícios. Execute em uma sessão PowerShell com `ExchangeOnlineManagement` disponível, usando a conta administrativa da organização:

```powershell
Connect-ExchangeOnline
$graphClientId = 'UUID-DO-CLIENT-ID'
$graphServicePrincipalId = 'UUID-DO-OBJETO-EM-APLICATIVOS-EMPRESARIAIS'
$graphSenderMailbox = 'carreiras@example.test'

Get-EXOMailbox -Identity $graphSenderMailbox
New-ServicePrincipal -AppId $graphClientId -ObjectId $graphServicePrincipalId -DisplayName 'Herbamed Carreiras - E-mail'
New-ManagementScope -Name 'HerbamedCarreiras-Remetente' -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$graphSenderMailbox'"
New-ManagementRoleAssignment -Name 'HerbamedCarreiras-MailSend' -Role 'Application Mail.Send' -App $graphServicePrincipalId -CustomResourceScope 'HerbamedCarreiras-Remetente'
Test-ServicePrincipalAuthorization -Identity $graphServicePrincipalId -Resource $graphSenderMailbox
Test-ServicePrincipalAuthorization -Identity $graphServicePrincipalId -Resource 'outra-caixa@example.test'
```

O teste deve indicar `InScope=True` para `Mail.Send` na caixa remetente e `False` em outra caixa existente. O teste do RBAC **não considera permissões concedidas separadamente no Entra**: revise também **Permissões de API** e os consentimentos existentes. Não conceda `Microsoft Graph → Mail.Send` irrestrito no Entra em paralelo à autorização limitada no Exchange. As permissões se somam e o escopo deixaria de limitar o acesso. Não use permissões amplas `Mail.ReadWrite` ou `Exchange Full Access`. Em uma aplicação nova de envio, permissões delegadas de login como `User.Read` também não são necessárias.

Alterações podem levar de 30 minutos a duas horas para refletir nas chamadas reais do Graph. Registros/escopos já existentes devem ser revisados antes de repetir os comandos de criação.

Referência: [RBAC for Applications](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

## 3. Testar a Microsoft antes de ativar cadastros

Crie **somente no computador** o arquivo `.env.graph.local`, ignorado pelo Git. Não substitua `.env` ou `.env.local` do ambiente Docker:

```dotenv
EMAIL_PROVIDER=microsoft_graph
MS_GRAPH_TENANT_ID=UUID-DO-TENANT
MS_GRAPH_CLIENT_ID=UUID-DO-CLIENT-ID
MS_GRAPH_CLIENT_SECRET=VALOR-DO-SEGREDO
MS_GRAPH_SENDER=carreiras@example.test
EMAIL_TEST_TO=destinatario-de-teste@example.test
```

Substitua os exemplos por dados reais somente nesse arquivo privado. Execute:

```powershell
npm run email:test -- --send
```

O comando envia **uma mensagem real** para o destinatário configurado, sem imprimir endereço, credenciais ou token. O resultado esperado é `Mensagem aceita pelo Microsoft Graph`; confira também a chegada na caixa de entrada/spam. `202 Accepted` não garante entrega final. O comando não altera usuários, MFA, variáveis da Vercel nem a flag de e-mail.

`mail_credentials_rejected`: confira credencial/validade/IDs. `mail_permission_denied`: confira escopo e autorização no Exchange. `mail_rate_limited`: limites do Exchange. `mail_timeout` ou `mail_provider_unavailable`: conectividade/disponibilidade. Confira também a caixa remetente e rastreamento de mensagens do Exchange quando não houver entrega.

## 4. Publicar o código e a migration

1. Confirme o projeto hospedado vinculado pelo CLI, distinto do banco local.
2. Revise `npx supabase db push --dry-run` e aplique `npx supabase db push`.
3. A migration `202610050001_graph_email_hook.sql` cria recibos privados de entrega e duas RPCs exclusivas do servidor. Não guarda e-mail, texto, OTP ou token, somente hashes, leases e timestamps; RLS ativo, sem escrita direta pela API. Os recibos expiram após dois dias, com limpeza limitada a cada nova chamada.
4. Publique esta versão na Vercel inicialmente mantendo `ENABLE_EMAIL=false`. O hook ainda não deve ser ativado no Supabase.

## 5. Configurar o Supabase e a Vercel

No **Supabase → Authentication → Hooks → Send Email Hook**, prepare um hook HTTP com a URL:

```text
https://SEU-DOMINIO-ESTAVEL/api/auth/send-email
```

Gere o segredo de assinatura (`v1,whsec_...`), guarde-o e mantenha o hook desativado até concluir o redeploy. Use um domínio público estável que possa receber POST sem login da Vercel. Não use um deployment de preview protegido. Não há chave service role nos headers do hook; a autenticação usa a assinatura do corpo.

Na **Vercel → Settings → Environment Variables → Production**, configure:

| Variável | Valor |
| --- | --- |
| `EMAIL_PROVIDER` | `microsoft_graph` |
| `MS_GRAPH_TENANT_ID` | ID do diretório/tenant |
| `MS_GRAPH_CLIENT_ID` | ID do aplicativo/cliente |
| `MS_GRAPH_CLIENT_SECRET` | Valor do segredo, somente servidor |
| `MS_GRAPH_SENDER` | Endereço simples da caixa autorizada, sem nome ou `< >` |
| `SUPABASE_SEND_EMAIL_HOOK_SECRET` | Segredo completo gerado pelo Supabase, somente servidor |
| `ENABLE_EMAIL` | `true` na etapa de ativação |
| `APP_URL` | Domínio estável da aplicação; links são construídos exclusivamente por essa variável |

Mantenha as variáveis Supabase já existentes. Não use prefixo `NEXT_PUBLIC_` nas novas variáveis. Nenhuma `SMTP_*` é necessária para Graph. O build exige as credenciais e o segredo do hook quando Graph e e-mail estão ativos; isso valida o formato, não as permissões reais da Microsoft.

No Supabase, mantenha o **provedor Email/senha habilitado**, **Confirm email ativo** e **Secure email change ativo**. A troca segura envia dois links: um ao endereço atual e outro ao novo. O hook recusa uma troca sem o par seguro de hashes. Os dados `site_url`/`redirect_to` recebidos no webhook não definem o domínio dos links.

Faça o redeploy com as novas variáveis e então habilite o Send Email Hook. Coordene essas etapas em uma janela curta de manutenção: Supabase e Vercel não mudam de configuração atomicamente. Teste cadastro fictício, confirmação, recuperação, código da Conta e alteração de e-mail com os dois links. O link abre uma tela e só consome o token após **Confirmar e continuar**, para evitar consumo por scanners de e-mail. O hook não recebe confirmação de chegada na caixa final: o sucesso representa aceite do Graph e gravação do recibo.

O hook HTTP do Supabase tem prazo de cinco segundos; chamadas ao Graph usam prazo total de quatro segundos e RPCs de recibos têm prazo de um segundo por chamada. Cold starts e rede podem causar timeout. Não há fila assíncrona neste fluxo: não respondemos sucesso antes de o Graph aceitar. Meça no ambiente hospedado antes de disponibilizar a candidatos reais.

Retries já concluídos são ignorados e a troca de e-mail tem recibos separados para cada endereço. Ainda pode haver duplicidade em timeout ambíguo ou falha ao gravar o recibo depois do aceite: Microsoft Graph `sendMail` não fornece garantia de entrega exatamente uma vez. Logs contêm eventos/códigos fixos, nunca destinatário, corpo, token ou resposta original do provedor.

## 6. Local, desativação e limites

`EMAIL_PROVIDER` ausente continua usando SMTP. O Docker fixa `EMAIL_PROVIDER=smtp` e usa o Mailpit local. Não foram alterados os arquivos privados `.env`/`.env.local`. Para testar os fluxos assinados locais: `npm run test:e2e:email` cria um servidor temporário na porta 3001, usa Supabase/Mailpit locais e dados fictícios, e o encerra ao terminar. Não é necessário mudar a configuração real de Auth Hook do Supabase local.

Para desativar na aplicação, configure `ENABLE_EMAIL=false` e faça redeploy. Desative também o hook no Supabase se quiser voltar ao envio SMTP do Auth; desativar a flag do Next.js não muda o painel do Supabase. Com hook ativo e flag falsa, o endpoint recusa envios. O login por senha permanece habilitado e o modo sem e-mail mantém o comportamento de demonstração existente.

Esta integração cobre autenticação e códigos da Conta. A outbox de recrutamento/worker legado continua desativada na Vercel; não foi convertida para Graph. Os limites e eventuais custos do Exchange, Vercel e Supabase continuam aplicáveis.

Referências: [OAuth client credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow), [Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0), [Send Email Hook e mapeamento da troca de e-mail](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Auth Hooks e planos](https://supabase.com/docs/guides/auth/auth-hooks).
