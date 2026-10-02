# Currículos e cadastros de vagas

Os cadastros do RH e do candidato compartilham os mesmos campos de currículo. A análise dos documentos de referência orientou os campos, sem importar pessoas ou arquivos reais para o banco ou para o Git.

## Currículo

Além dos dados existentes, o cadastro permite telefone alternativo, bairro, habilitação, um segundo link profissional (GitHub, portfólio ou site), disponibilidade para viagens e mudança de cidade. Os campos são opcionais e gravados em `candidates.additional_info` por RPC autorizado. Não foram adicionados idade, estado civil ou documentos de identificação como requisitos de candidatura.

Habilidades são adicionadas por texto ou Enter e aparecem como cards removíveis. Não há duplicação por diferença de maiúsculas/minúsculas; são aceitas até 30 habilidades de 100 caracteres. Um texto ainda não adicionado impede o envio para evitar perda acidental.

A trajetória mantém experiência, formação, curso, certificação e idioma. Agora inclui nível/semestre, situação, carga horária e período em texto para datas desconhecidas. Idiomas dispensam instituição. Experiência e formação continuam exigindo instituição. Não ter uma data final não significa automaticamente que uma formação ou experiência está em andamento; a situação é explícita. A revisão do currículo e o PDF incluem os novos dados.

Áreas de interesse exibem mensagem quando não há opções ativas e mensagem diferente quando a consulta falha. As opções reais devem ser cadastradas pelo RH em Configurações; não é aplicado seed de áreas fictícias na nuvem.

## Vagas e configurações

Responsabilidades, requisitos e benefícios são listas de itens adicionáveis, editáveis e removíveis. A gravação mantém as colunas de texto existentes, com um item por linha; textos antigos são preservados. O detalhe público apresenta listas com marcadores.

Nível de experiência e tipo de emprego usam `experience_levels` e `employment_types`. Contrato (CLT, PJ etc.) continua sendo um campo separado do tipo de emprego (tempo integral, meio período etc.). Os catálogos trazem opções comuns iniciais, editáveis e desativáveis pelo RH autorizado.

Configurações oferece inclusão, edição, ativação/desativação e exclusão para departamentos, áreas de interesse, tags, pools, níveis de experiência e tipos de emprego. Exclusões de cadastros vinculados são bloqueadas e orientam a desativação. Os novos catálogos têm RLS, apenas leitura direta e auditoria; mutações exigem `settings.manage`, incluindo o MFA vigente. Vagas existentes mantêm referências a opções desativadas.

## Atualização e validação

Aplicar `202610020002_curriculum_and_job_catalogs.sql` no Supabase hospedado antes de publicar o código. Nenhuma variável de ambiente nova é necessária. A migration mantém as implementações anteriores de autorização e limites como funções privadas, acessadas por wrappers autorizados, e preserva dados complementares quando clientes antigos não enviam esses campos.

O menu de RH passa a consultar permissões em uma única chamada. `requireStaff` é reaproveitado dentro da requisição, consultas independentes do perfil rodam em paralelo e a atualização redundante após salvar foi removida. Isso reduz chamadas; não mede nem garante a latência da hospedagem.

Verificação: `npm run check`, `npm run test:db` e `node scripts/smoke-curriculum-fields.mjs`. O último usa somente Supabase local, servidor de teste na porta 3001, contas fictícias, gestor com MFA e limpeza dos registros criados. Capturas e PDF de teste ficam em `artifacts/`, ignorado pelo Git.
