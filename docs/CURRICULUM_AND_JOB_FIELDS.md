# Currículos e cadastros de vagas

Os cadastros do RH e do candidato compartilham os mesmos campos de currículo. A análise dos documentos de referência orientou os campos, sem importar pessoas ou arquivos reais para o banco ou para o Git.

## Currículo

A etapa Revisar e exportar apresenta o currículo como um documento profissional: nome e título em destaque, contatos formatados, resumo, seções separadas de experiência, formação, cursos, certificações e idiomas, habilidades, competências pessoais e informações complementares. Instituição, período e detalhes com marcadores têm hierarquia própria; somente dados preenchidos aparecem. O aviso de prontidão fica ao lado, com espaçamento entre a mensagem e as ações, e abaixo do documento em telas menores.

A revisão e a exportação compartilham o mesmo modelo de conteúdo. O PDF do candidato e do gestor usa A4, margens, títulos de seção, datas alinhadas, marcadores com recuo, identificação nas páginas seguintes e numeração. Se um registro continuar em outra página, a seção e o título indicam a continuação. CPF, nascimento e registros internos de tratamento de dados não compõem o currículo profissional. Este ajuste visual não exige migration nem alteração de variáveis de ambiente.

As descrições de Experiência Profissional, Histórico Acadêmico, Cursos, Certificados e Idiomas usam listas editáveis. É possível adicionar um detalhe por vez ou vários separados por `;`, editar e remover cada item. A revisão e o PDF exibem marcadores, com recuo nas linhas continuadas. Idioma, nível e demais campos continuam separados; a lista de detalhes é opcional. A coluna `profile_entries.description` continua sendo texto com um item por linha; conteúdo legado com ponto e vírgula é preservado ao abrir a edição. Este ajuste não exige migration nem variável nova.

Além dos dados existentes, o cadastro permite telefone alternativo, bairro, habilitação, um segundo link profissional (GitHub, portfólio ou site), disponibilidade para viagens e mudança de cidade. Os campos são opcionais e gravados em `candidates.additional_info` por RPC autorizado. Não foram adicionados idade, estado civil ou documentos de identificação como requisitos de candidatura.

Habilidades são adicionadas por texto ou Enter e aparecem como cards removíveis. Não há duplicação por diferença de maiúsculas/minúsculas; são aceitas até 30 habilidades de 100 caracteres. Um texto ainda não adicionado impede o envio para evitar perda acidental.

Competências Pessoais têm um card independente de habilidades técnicas, com inclusão e remoção de até 30 itens de 100 caracteres, armazenados em `additional_info.personal_competencies` e exibidos no perfil, revisão e PDF.

Experiência Profissional, Histórico Acadêmico, Cursos, Certificados e Idiomas têm cards próprios. No cadastro inicial do RH e do candidato, os itens são adicionados e removidos em memória e enviados em `initial_entries` (até 50). O botão final salva candidato, competências e trajetória na mesma transação; erro em qualquer item desfaz o cadastro inteiro. Rascunhos preenchidos mas não adicionados bloqueiam o envio com orientação. Depois do cadastro, cada card mantém adição, edição e remoção via RPCs existentes. A inclusão inicial do candidato é serializada por conta para impedir duplicação em reenvios.

A trajetória mantém experiência, formação, curso, certificação e idioma. Agora inclui nível/semestre, situação, carga horária e período em texto para datas desconhecidas. Idiomas dispensam instituição. Experiência e formação continuam exigindo instituição. Não ter uma data final não significa automaticamente que uma formação ou experiência está em andamento; a situação é explícita. A revisão do currículo e o PDF incluem os novos dados.

Áreas de interesse exibem mensagem quando não há opções ativas e mensagem diferente quando a consulta falha. As opções reais devem ser cadastradas pelo RH em Configurações; não é aplicado seed de áreas fictícias na nuvem.

## Vagas e configurações

O topo do menu mantém logo e subtítulo centralizado em uma linha, com rolagem somente nos links e rodapé separado. Em celular a marca fica no topo fixo da área de trabalho. Os cards de trajetória alinham ao início da grade: abrir uma seção não estica as demais.

Em cadastros manuais, `legal_basis` é o registro da hipótese legal e da referência à avaliação feita pela Herbamed para tratar os dados recebidos. Continua obrigatório junto à origem e finalidade, com explicação em tela; não recebe uma base presumida pelo software.

Etapas do processo aceitam edição de nome, inclusão, remoção, marcação como final e reordenação com Subir/Descer. Clique em Salvar etapas para persistir o conjunto. A primeira etapa deve ser aberta, com 1 a 50 etapas no total. A RPC `save_job_stages` exige `jobs.manage` e o MFA vigente, trava a vaga, valida o estado anterior contra alterações concorrentes e salva a ordem atomicamente, preservando os IDs. Etapas referenciadas por candidaturas ou eventos não podem ser excluídas nem ter sua condição final reinterpretada; podem ser renomeadas ou reordenadas. As FKs, RLS e auditoria existentes continuam ativas.

Perguntas aceitam Texto (resposta livre) ou Opção (escolha única), e podem ser obrigatórias ou opcionais. O gestor inclui, edita ou remove alternativas individualmente ou por `;`, com 2 a 30 alternativas distintas de até 200 caracteres e até 50 perguntas por vaga. As RPCs `save_job_question` e `delete_job_question` exigem a mesma permissão e MFA. Perguntas respondidas não podem ser excluídas ou mudar de conteúdo/tipo/opções; a obrigatoriedade para novas candidaturas pode ser ajustada. Perguntas antigas recebem o tipo Texto sem alterar respostas existentes. `submit_application` verifica perguntas da vaga, respostas obrigatórias, limites e alternativas válidas no servidor, incluindo chamadas diretas à RPC.

Após gravar uma candidatura, a navegação para o acompanhamento ocorre no servidor, preservando o redirecionamento mesmo quando a revalidação substitui o formulário pela indicação de candidatura existente.

Antes de publicar, aplicar `202610020004_job_process_editor.sql` no banco hospedado. Aplicada e testada localmente; nenhuma variável de ambiente nova.

Responsabilidades, requisitos e benefícios são listas de itens adicionáveis, editáveis e removíveis. A gravação mantém as colunas de texto existentes, com um item por linha; textos antigos são preservados. O detalhe público apresenta listas com marcadores.

Os três campos aceitam vários itens separados por `;`, ao clicar em Adicionar ou pressionar Enter. Espaços e fragmentos vazios são removidos; duplicados não são incluídos e lotes que excedam o limite são rejeitados integralmente. A separação só ocorre na inclusão nova, sem reinterpretar conteúdo já cadastrado. A ajuda abaixo do campo tem espaçamento próprio e os itens adicionados têm fundo suave diferente do restante do card.

Nível de experiência e tipo de emprego usam `experience_levels` e `employment_types`. Contrato (CLT, PJ etc.) continua sendo um campo separado do tipo de emprego (tempo integral, meio período etc.). Os catálogos trazem opções comuns iniciais, editáveis e desativáveis pelo RH autorizado.

Configurações oferece inclusão, edição, ativação/desativação e exclusão para departamentos, áreas de interesse, tags, pools, níveis de experiência e tipos de emprego. Exclusões de cadastros vinculados são bloqueadas e orientam a desativação. Os novos catálogos têm RLS, apenas leitura direta e auditoria; mutações exigem `settings.manage`, incluindo o MFA vigente. Vagas existentes mantêm referências a opções desativadas.

## Atualização e validação

Aplicar `202610020002_curriculum_and_job_catalogs.sql` no Supabase hospedado antes de publicar o código. Nenhuma variável de ambiente nova é necessária. A migration mantém as implementações anteriores de autorização e limites como funções privadas, acessadas por wrappers autorizados, e preserva dados complementares quando clientes antigos não enviam esses campos.

Aplicar também `202610020003_curriculum_sections.sql` antes desta versão. Ela acrescenta validação de competências e gravação inicial da trajetória, sem criar tabelas, mudar as políticas RLS ou ampliar permissões. Atualizações parciais antigas de `additional_info` preservam competências já cadastradas; enviar a lista vazia remove-as explicitamente. Os helpers novos continuam privados e não executáveis por `anon`/`authenticated`.

O menu de RH passa a consultar permissões em uma única chamada. `requireStaff` é reaproveitado dentro da requisição, consultas independentes do perfil rodam em paralelo e a atualização redundante após salvar foi removida. Isso reduz chamadas; não mede nem garante a latência da hospedagem.

Verificação: `npm run check`, `npm run test:db` e `node scripts/smoke-curriculum-fields.mjs`. O último usa somente Supabase local, servidor de teste na porta 3001, contas fictícias, gestor com MFA e limpeza dos registros criados. Capturas e PDF de teste ficam em `artifacts/`, ignorado pelo Git.
