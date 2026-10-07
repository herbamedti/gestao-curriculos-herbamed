export type ActionResult = { ok: boolean; message: string; redirect?: string };
export const initialResult: ActionResult = { ok: false, message: '' };
export function safeError(code?: string, message?: string): ActionResult {
  const known: Record<string, string> = {
    account_reason_required: 'Informe um motivo entre 3 e 1.000 caracteres.',
    invalid_portal_account: 'Esta conta não pode ser administrada pela tela de candidatos.',
    job_process_changed: 'As etapas foram alteradas por outra pessoa. Recarregue a página antes de salvar novamente.',
    stage_in_use: 'Uma etapa removida ou com situação final alterada já possui candidaturas ou histórico. Mantenha essa etapa; você pode renomeá-la ou mudar sua ordem.',
    initial_stage_final: 'A primeira etapa recebe inscrições e não pode ser final.',
    invalid_stages: 'Mantenha de 1 a 50 etapas com nomes de 2 a 100 caracteres. A primeira etapa deve ser aberta.',
    invalid_question: 'Revise a pergunta. Perguntas de opção exigem de 2 a 30 alternativas distintas.',
    question_in_use: 'Esta pergunta já tem respostas recebidas. Mantenha seu conteúdo e opções para preservar o histórico; crie outra pergunta se necessário.',
    question_limit: 'O limite de 50 perguntas desta vaga foi atingido.',
    invalid_answer_option: 'Uma opção de resposta foi alterada. Recarregue a página e escolha uma opção disponível.',
    invalid_answer: 'Revise suas respostas ou recarregue a página caso as perguntas tenham sido atualizadas.',
    invalid_initial_entries: 'Revise as informações adicionadas aos cards de trajetória. Nenhum dado foi salvo.',
    initial_profile_exists: 'Este currículo já foi cadastrado. Recarregue a página para editar os dados e adicionar informações de trajetória.',
    catalog_in_use: 'Este cadastro está em uso. Desative-o para impedir novas seleções e preservar os registros existentes.',
    inactive_catalog_item: 'A opção selecionada foi desativada. Atualize a página e escolha uma opção ativa.',
    invalid_entry_dates: 'Uma experiência ou formação em andamento não deve ter data de fim.',
    curriculum_incomplete: 'Complete os dados essenciais do currículo antes de se candidatar.',
    already_linked: 'Esta pessoa já está vinculada à vaga selecionada.',
    job_unavailable: 'A vaga não está disponível para vinculação.',
    login_email_locked: 'O e-mail de acesso da conta cadastrada no portal não pode ser alterado aqui.',
    link_reason_required: 'Informe o motivo da vinculação com pelo menos três caracteres.',
    purpose_required: 'Informe origem, finalidade e base legal do cadastro manual.',
    complete_profile: 'Complete seu currículo antes de continuar.',
    answer_required: 'Responda todas as perguntas obrigatórias.',
    invalid_policy: 'O aviso de privacidade foi atualizado. Recarregue a página e revise a nova versão.',
    invalid_policy_content: 'Confira a versão (2 a 40 caracteres), o título (5 a 160) e o texto integral (100 a 100.000). O aviso anterior foi preservado.',
    policy_version_exists: 'Esta versão já foi publicada. Informe uma nova versão; o histórico não pode ser sobrescrito.',
    application_changed: 'Esta candidatura foi alterada. Atualize a página antes de tentar novamente.',
    too_many_interests: 'O limite de áreas de interesse foi excedido.',
    user_must_sign_in_first: 'A pessoa precisa entrar com Microsoft uma vez antes de receber um perfil.',
    cannot_change_self: 'A alteração do seu próprio acesso exige outro administrador.',
    cannot_change_own_role: 'Seu próprio perfil deve ser alterado por outro administrador.',
    rate_limit: 'Limite de tentativas atingido. Tente novamente mais tarde.',
    invalid_registration: 'Informe um CPF válido e uma data de nascimento válida, que não esteja no futuro.',
  };
  if (code === '23505') return { ok: false, message: 'Já existe um registro com estes dados. Nenhuma duplicação foi criada.' };
  if (code === '42501') return { ok: false, message: 'Seu acesso não permite esta operação.' };
  return { ok: false, message: known[message || ''] || 'Não foi possível concluir. Verifique os dados e tente novamente.' };
}
