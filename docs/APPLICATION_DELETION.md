# Exclusão administrativa de candidaturas

A faixa visual de ambiente foi removida do layout comum de todas as páginas. `APP_ENV`, indexação e flags de segurança/envio não foram alterados por essa mudança visual.

A exclusão definitiva aparece somente para o administrador geral designado em `private.primary_administrator`, com sessão interna ativa e MFA em AAL2. Ter um perfil chamado Superadministrador não concede essa operação a outro usuário. Não existe permissão delegável de exclusão.

## Operação

O ícone de lixeira fica em **RH → Candidaturas**, ao lado de **Abrir**, e em **Candidatos da vaga**. O detalhe da candidatura também apresenta **Excluir candidatura**. A opção vale para candidaturas ativas, encerradas, retiradas e já desvinculadas.

O modal explica o alcance, exige digitar **EXCLUIR** e oferece cancelamento. Durante o envio, o botão mostra carregamento e o fechamento fica bloqueado. Após excluir, a aplicação retorna à lista de candidaturas com mensagem de confirmação.

| Removido definitivamente | Preservado |
| --- | --- |
| Candidatura selecionada | Conta e currículo do candidato |
| Respostas às perguntas dessa candidatura | Formação, experiência e outros dados do currículo |
| Movimentações de etapas e avaliações desse processo | Outras candidaturas, vaga e perguntas configuradas |
| Entrevistas vinculadas ao processo, inclusive agendadas | Auditoria de quem excluiu, data e ID do registro |

Mensagens e notificações do candidato não possuem vínculo exclusivo por candidatura e permanecem preservadas. Esta operação não representa exclusão da conta ou solicitação LGPD. Os registros do processo removido não podem ser recuperados pela interface.

## Segurança e consistência

- A interface usa a RPC existente `is_primary_administrator`; falha na consulta oculta a opção.
- A Server Action valida sessão, autorização, UUID, versão e confirmação com Zod. Nenhuma chave de serviço é enviada ao navegador.
- `public.delete_application(uuid,timestamptz)` verifica novamente a identidade do principal e AAL2 no banco, aplica limite de requisições e bloqueia a candidatura durante a transação.
- Uma alteração concorrente, versão ausente ou registro já excluído é recusado. Todas as exclusões e seus registros de auditoria são atômicos. Escrita direta continua proibida para `authenticated`; não há concessão para anônimos ou service role nessa RPC.
- Auditoria mantém apenas os campos existentes de ator, operação, recurso, ID e data; conteúdo de currículo e respostas não é copiado para logs.
- A invalidação das páginas RH/candidato atualiza lista, pipeline, entrevistas, indicadores e portal. O redirecionamento ocorre no servidor, mesmo se a remoção desmontar o formulário.

## Publicação e testes

Aplicar `supabase/migrations/202610150003_delete_application.sql` no Supabase hospedado antes de publicar esta versão. As migrations anteriores continuam necessárias; usar a ordem normal, sem reset/seed em produção. Não há variável de ambiente nova. Nenhuma candidatura real é excluída pela implementação ou pelos testes locais.

Comandos de verificação: `npm run check`, `npm run test:db`, `npm run db:types` e `npm run test:e2e:application-delete`. O smoke recusa banco remoto, usa contas fictícias, confirma TOTP, compara principal e delegado, testa cancelar/conflito/excluir, confere preservação de currículo e outra candidatura, auditoria e reflexo no portal. O principal original é restaurado e as fixtures são removidas ao final.

Validação concluída: lint, TypeScript, build, 56 testes Vitest, 454 verificações pgTAP e smoke de navegador aprovados. Modal mobile inspecionado, sem transbordamento ou herança de alinhamento da tabela. Tipos regenerados no Supabase local.
