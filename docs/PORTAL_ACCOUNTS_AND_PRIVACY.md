# Contas de candidatos, aviso e banco de talentos

## Aviso de privacidade e candidatura

O envio exige um registro em `privacy_policies` com `active=true` e `published_at` preenchido e não futuro. Uma consulta com erro apresenta mensagem diferente de ausência do aviso. O bloqueio também existe na RPC `submit_application`; não basta alterar o formulário para enviar sem aviso.

No ambiente hospedado, entrar com o administrador autorizado, acessar **Solicitações LGPD** (`/rh/privacidade`), informar versão, título e texto integral aprovado pela Herbamed, confirmar a aprovação e publicar. Conferir `/privacidade` e recarregar a candidatura. A publicação exige `privacy.manage` e o MFA vigente. O seed de aviso fictício é exclusivamente local; nenhuma migration publica automaticamente um texto jurídico na nuvem.

### Editor e histórico de avisos

Aplicar também `202610070002_privacy_policy_editor.sql` no banco hospedado antes de publicar o código correspondente na Vercel. Ela alinha a RPC com o limite de **100.000 caracteres** da validação do servidor e do contador do editor; o limite anterior era 10.000 no formulário/servidor e 20.000 na RPC. O corpo continua como texto no PostgreSQL; não há bucket, upload de PDF ou variável nova. Esse tamanho comporta avisos extensos sem depender de Storage. O limite de requisição de Server Actions permanece em 1 MB.

O editor carrega o aviso vigente como base, exige um novo identificador de versão (2–40 caracteres), título (5–160), corpo (100–100.000 após aparar espaços externos) e confirmação de aprovação. Permite colar o conteúdo completo sem truncamento silencioso. Se exceder o limite ou houver falha, mostra mensagem e conserva os campos digitados na mesma tela. O rascunho não é salvo automaticamente: trocar de página/recarregar descarta alterações ainda não publicadas.

**Histórico de avisos** lista vinte versões por página com data e situação. **Consultar / usar como base** carrega a versão selecionada no editor e oferece consulta do texto original. Corrigir um aviso significa publicar uma versão nova; não sobrescrever nem excluir a anterior. A publicação desativa somente a vigência anterior, mantendo IDs, título, texto, data e `policy_acknowledgements.policy_id`. Identificadores repetidos são rejeitados com mensagem específica. Publicações simultâneas são serializadas no banco.

A consulta pública e o texto original no histórico formatam títulos com `#`, listas com `-`/`*` ou numeração e destaques `**`. HTML e scripts permanecem texto, sem execução; isso não é um editor completo de Markdown. A publicação pública exige vigência e data não futura.

Validação: `013_privacy_policy_editor.sql` verifica limites, versão repetida, preservação de ciência/texto/vigência, RLS e MFA; `src/modules/privacy/policy.test.tsx` verifica validação e formatação segura. `node scripts/smoke-privacy-policy.mjs` testa publicação extensa, erros sem perda do rascunho, consulta/cópia do histórico e apresentação desktop/mobile. Usa exclusivamente fixtures locais fictícias e restaura o aviso previamente ativo ao terminar. Não executar junto com outros testes ou usuários publicando avisos no mesmo banco. Capturas em `artifacts/privacy-policy/` são ignoradas pelo Git.

## Banco de talentos

A conta e o currículo não ativam `candidates.talent_pool`. A candidatura a uma vaga também não autoriza automaticamente participação para oportunidades futuras. O candidato deve marcar **Quero participar do banco de talentos** e salvar em **Meu currículo → Revisar e exportar** ou **Privacidade**. É necessário aviso vigente. Desmarcar e salvar revoga essa escolha; o currículo e as candidaturas permanecem.

O RH vê somente os perfis com essa escolha em Banco de talentos (`/rh/talentos`, que redireciona para `/rh/candidatos?pool=1`). A página explica o filtro e oferece acesso à lista geral de Candidatos. A nova gestão de contas lista inclusive pessoas que ainda não montaram currículo, mostrando separadamente confirmação do e-mail, existência do currículo e participação no banco.

## Administração de acesso

**Administração → Contas de candidatos** (`/rh/contas-candidatos`) oferece busca por nome/e-mail, filtro de acesso e paginação de vinte contas. Somente o administrador principal com AAL2 pode listar ou alterar essas contas. A página, ação de servidor e RPCs exigem autorização; usuários internos são excluídos desta tela e continuam administrados em `/rh/usuarios`.

Desativar ou reativar exige motivo de 3 a 1.000 caracteres. O estado e o motivo ficam na tabela privada `portal_account_access`, com RLS e sem privilégios diretos de leitura/escrita pela API. Auditoria registra ator, ação e ID, sem copiar e-mail, motivo ou currículo ao log público de auditoria. Não há exclusão de conta, currículo ou candidaturas.

O bloqueio vale para login e páginas da aplicação, leituras RLS do candidato/notificações e RPCs de currículo, candidatura, privacidade, exportação e Conta. Implementações anteriores permanecem privadas e inacessíveis diretamente. A desativação invalida o acesso das sessões existentes. Após reativar, somente uma sessão Auth criada depois da alteração é aceita; renovar o token de uma sessão antiga não libera acesso. O candidato recebe orientação em `/conta-indisponivel` para sair e entrar novamente.

A restrição controla o acesso à plataforma: não remove credenciais nem bloqueia as páginas públicas. Tokens do Supabase podem continuar tecnicamente válidos até expirar, mas não autorizam os dados e operações protegidos da aplicação.

## Publicação e testes

Aplicar a nova migration **`202610070001_portal_account_access.sql`** no Supabase hospedado antes de publicar o código na Vercel. Executar o arquivo completo; não selecionar apenas funções isoladas. Não há variável nova de ambiente. A migration foi aplicada somente no banco local; a aplicação passou a exigir sua RPC de acesso também no login.

`npm run check` verifica lint, TypeScript, Vitest e build. `npm run test:db` inclui `012_portal_account_access.sql`: autorização principal/MFA, exclusão de equipe, contas sem currículo, busca literal, motivo obrigatório, bloqueio RLS/RPC, preservação de registros, reativação/novo login e auditoria. Total local: 251 pgTAP.

`npm run test:e2e:registration` valida escolha/revogação do banco, gestão de contas no navegador, sessões/API/PDF bloqueados, reativação e login novo, além do fluxo de equipe existente. `node scripts/smoke-curriculum-fields.mjs` verifica candidatura indisponível sem aviso, restauração do aviso e envio com perguntas espaçadas em desktop/celular. Ambos usam dados fictícios e Supabase local. O segundo pausa brevemente os avisos locais ativos e restaura seus IDs mesmo em caso de falha; o primeiro restaura o principal de teste. Não executar enquanto outra pessoa testa esses fluxos no mesmo banco local. Capturas ficam em `artifacts/`, ignorado pelo Git.
