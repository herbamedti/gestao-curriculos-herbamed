export type ActionResult = { ok: boolean; message: string; redirect?: string };
export const initialResult: ActionResult = { ok: false, message: '' };
export function safeError(code?: string, message?: string): ActionResult {
  const known: Record<string, string> = {
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
    application_changed: 'Esta candidatura foi alterada. Atualize a página antes de tentar novamente.',
    too_many_interests: 'O limite de áreas de interesse foi excedido.',
    user_must_sign_in_first: 'A pessoa precisa entrar com Microsoft uma vez antes de receber um perfil.',
    cannot_change_self: 'A alteração do seu próprio acesso exige outro administrador.',
    cannot_change_own_role: 'Seu próprio perfil deve ser alterado por outro administrador.',
    rate_limit: 'Limite de tentativas atingido. Tente novamente mais tarde.',
  };
  if (code === '23505') return { ok: false, message: 'Já existe um registro com estes dados. Nenhuma duplicação foi criada.' };
  if (code === '42501') return { ok: false, message: 'Seu acesso não permite esta operação.' };
  return { ok: false, message: known[message || ''] || 'Não foi possível concluir. Verifique os dados e tente novamente.' };
}
