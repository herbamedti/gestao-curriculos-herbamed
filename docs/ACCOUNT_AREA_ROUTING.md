# Entrada na área correta

O botão público **Minha área** usa `/minha-area`, uma página com redirecionamento no servidor. Não é necessário sair da conta ou digitar a senha novamente enquanto a sessão for válida.

| Estado validado | Destino |
| --- | --- |
| Visitante sem sessão válida | `/entrar` |
| Candidato com cadastro concluído | `/candidato` |
| Equipe autorizada com MFA pendente | `/seguranca` |
| Equipe autorizada | Primeira tela permitida do RH; `/rh` quando há acesso ao dashboard |
| Equipe sem permissão para outras telas | `/rh/conta` |
| Conta desativada ou sessão revogada/não autorizada | `/conta-indisponivel` |
| Convite sem senha ou Google sem identificação | Onboarding existente antes de entrar na área |

O mesmo critério vale para login já autenticado, conclusão do MFA e retorno de confirmação/OAuth. `perfil`, `next`, endereço de e-mail e metadata editável do usuário não concedem perfil interno. Falha na consulta não recebe fallback de candidato. URLs externas não são aceitas como destino dessa entrada.

O layout **e cada página** de `/candidato` usam `requireCandidate()`, porque o layout sozinho não protege consultas concorrentes nem ações. A candidatura pública e sua ação também usam esse guard. `requireStaff()` exige identidade interna e MFA quando obrigatório, mantendo permissões de página/RPC/RLS. A tela de segurança permanece disponível para concluir o fator, evitando loop.

No banco, `account_area()` consulta somente o próprio usuário autenticado e usa cadastro interno, estado da sessão e nível AAL do JWT validado. O principal exige AAL2 independentemente da flag individual. Contas internas não podem criar currículo próprio, aderir ao banco de talentos, enviar candidatura pessoal ou usar a desistência pessoal por RPC. Propriedade de eventual currículo histórico não concede acesso de candidato. Nenhum registro histórico é removido; o RH continua gerenciando candidatos por permissões e escopo próprios.

Publicação: aplicar `supabase/migrations/202610150002_account_area_separation.sql` antes do código. Caso a entrega anterior esteja pendente, aplicar também `202610150001_signup_and_recovery_guards.sql` em ordem. Não há variáveis de ambiente novas e não é necessário criar outro usuário para o administrador. Nenhuma migração hospedada ou alteração de credenciais é executada por esta correção.

Verificação: `npm run check`, `npm run test:db`, `npm run db:types` e `npm run test:e2e:area`. O smoke usa apenas usuários fictícios e banco local, autentica um gestor com TOTP real, confere o botão público, acesso direto a todas as telas de candidato, login já autenticado, candidato sem acesso ao RH, conta interna sem dashboard, desativação, parâmetros forjados e ausência de currículo criado pela navegação. Fixtures são removidas ao final, sem alterar contas ou MFA existentes.
