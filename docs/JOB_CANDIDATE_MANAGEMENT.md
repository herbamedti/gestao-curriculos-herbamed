# Candidatos por vaga

## Uso

Em **Vagas**, cada registro tem **Candidatos**. O detalhe da vaga apresenta **Candidatos da vaga**; o pipeline possui **Lista de candidatos**. A nova tela fica em `/rh/vagas/[id]/candidatos`.

Há resumo de vínculos atuais, candidaturas em andamento e desvinculados; busca por nome/e-mail/área, filtro de etapa e situação e paginação no servidor de 20 registros. Os números são contagens reais da vaga autorizada. A visão inicial mostra vínculos atuais, incluindo candidaturas encerradas ou retiradas pelo candidato; desvinculados ficam no filtro de histórico.

Cada linha oferece consulta ao processo/respostas/histórico, consulta/edição do currículo, edição de etapa/situação em modal e desvinculação. **Vincular candidato** abre busca paginada por nome/e-mail, seleção e motivo obrigatório. O vínculo exige currículo completo e vaga publicada, pública, dentro do prazo e com etapas, mantendo as condições anteriores da plataforma. Perfis com escopo de vagas atribuídas continuam vendo somente candidatos autorizados; a busca não amplia esse escopo.

**Desvincular** é a exclusão da pessoa apenas deste processo seletivo. Preserva currículo, conta, respostas, avaliações, histórico e candidaturas em outras vagas. Exige motivo, encerra a candidatura e cancela entrevistas ainda agendadas para esse vínculo. Uma nova vinculação pelo RH reutiliza o mesmo registro, volta à primeira etapa e registra o retorno; entrevistas canceladas não são reativadas. A data de inscrição original permanece e o retorno aparece no histórico. A pessoa recebe uma notificação no portal; envio operacional por e-mail continua dependendo do worker existente.

A edição permite mudar etapa e situação para em andamento/encerrada. Se a pessoa havia retirado a candidatura, a retomada administrativa deve ser explícita e justificada. Alterações e desvinculações conferem a versão exibida: em caso de edição simultânea, não sobrescrevem o registro e solicitam recarregar. Uma candidatura desvinculada permanece consultável pelo titular como **Desvinculada da vaga**. Nova inscrição pública para o mesmo par candidato/vaga continua sujeita à unicidade anterior; o RH pode vincular novamente pelo fluxo descrito.

## Permissões e persistência

- Leitura da lista exige `applications.read` e `candidates.read` na vaga.
- Edição do currículo exige `candidates.edit` com verificação por candidato.
- Edição do processo exige `applications.move`; vínculo exige `applications.link`.
- Desvinculação exige a nova `applications.unlink`, concedida inicialmente aos perfis que já tinham `applications.link`. O principal pode bloqueá-la individualmente na aba Permissões.
- Verificações na página, ações/RPCs, RLS, MFA e escopo permanecem obrigatórias. Escrita direta em aplicações continua revogada; não há service role no navegador.
- A coluna `unlinked_at` usa a RLS já existente de aplicações. Constraint exige status encerrado quando desvinculada. Auditoria e histórico são preservados. Um trigger impede novos agendamentos em candidaturas inativas e serializa agendamento/desvinculação pelo bloqueio da aplicação.

## Referência de interface

A solução combina lista por vaga com filtros, ações de processo próximas do candidato e o pipeline existente. Essa organização aparece na [documentação oficial do Workable](https://help.workable.com/hc/en-us/articles/115012857047-Candidate-profile-in-pipeline-view-overview). O tratamento separado da pessoa em cada vaga, preservando outras candidaturas, está descrito em [Disqualifying/rejecting candidates](https://help.workable.com/hc/en-us/articles/115004710893-Disqualifying-rejecting-candidates). As regras de desvinculação acima são da Herbamed, não uma cópia de regras desse produto.

## Publicação e testes

Aplicar no Supabase hospedado, nesta ordem, antes do código na Vercel:

1. `supabase/migrations/202610130001_job_candidate_management.sql`
2. `supabase/migrations/202610130002_inactive_application_interviews.sql`

Não há variáveis de ambiente novas. As migrations preservam registros atuais. Não executar seed/reset em produção. Foram aplicadas somente no banco local durante o desenvolvimento.

Verificação: `npm run check`, `npm run test:db`, `npm run db:types` e `node scripts/smoke-job-candidates.mjs`. O smoke exige Supabase/PostgreSQL locais, usa dados fictícios, MFA real local e servidor temporário na porta 3001. Testa vínculo, edição, conflito de versão, desvinculação/retorno, consulta ao currículo, filtros/paginação, restrições de ações e responsividade.
