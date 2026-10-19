# Divulgação de vagas

## Uso pelo RH

Na gestão em `/rh/vagas/[id]`, o card **Divulgação da vaga** fica abaixo de **Publicação**. O usuário com leitura autorizada da vaga pode copiar o endereço público ou gerar a postagem; não é necessário conceder permissão de edição/publicação para baixar a arte.

**Gerar postagem** abre primeiro o modal **Preparar postagem da vaga**, sem iniciar a renderização. Os primeiros três requisitos e quatro benefícios vêm selecionados para revisão; os demais textos cadastrados ficam disponíveis. É possível trocar o conteúdo principal para **Responsabilidades** ou **Descrição da vaga**, selecionar/remover itens e adicionar/editar textos próprios. A seleção e a edição são locais ao modal. A ordem cadastrada orienta os destaques iniciais; não há ranqueamento por IA.

Cada texto selecionado tem contador e aviso individual acima de 110 caracteres em requisitos/responsabilidades, 250 na descrição e 65 nos benefícios. Os avisos são orientativos: a imagem resume textos longos com reticências para preservar o layout. Aceita até três destaques ou uma descrição, além de até quatro benefícios; seleções sem benefícios omitem essa seção. Textos vazios devem ser preenchidos ou desmarcados.

O botão **Gerar postagem** dentro do modal confirma os textos e abre a prévia, com download em PNG (1080 × 1350) e **Copiar link**. **Editar textos** volta à preparação preservando a seleção e as edições; fechar/cancelar descarta a preparação. Durante a geração, o formulário mostra carregamento e bloqueia envio repetido/fechamento. Falhas mantêm o rascunho para nova tentativa. Quando a área de transferência não está disponível, o campo fica selecionado para cópia manual. A página pública da vaga também apresenta o endereço e a cópia.

A preparação parte da última versão salva. Os textos ajustados no modal são enviados apenas para a renderização; título, local, contrato e URL sempre vêm da vaga no servidor. Alterações ainda não salvas no editor da vaga não entram na imagem. Salvar a vaga remonta o card e descarta qualquer preparação antiga. Não há publicação automática em redes sociais; baixe o PNG e cole o link junto com a postagem. Uma imagem não contém links clicáveis.

## Modelo e conteúdo

A composição do modelo fornecido foi recriada em elementos vetoriais: fundo verde, logo institucional, destaque “temos vagas”, ilustração de crachá, título em faixa e colunas de informações. O PDF de referência e os dados de outras vagas não foram incorporados ao repositório. A logo vem do ativo institucional já existente.

Entram título, cidade/UF, modelo de trabalho e contrato, até três destaques da seção escolhida ou uma descrição, além de até quatro benefícios. A seleção inicial respeita a ordem cadastrada e oferece a descrição quando não há requisitos/responsabilidades. Textos extensos são resumidos com reticências e o título ajusta o tamanho de fonte. O rodapé exibe o endereço da vaga. Benefícios não selecionados não entram na imagem; sem benefícios, o texto principal ocupa a largura disponível. Não são inventados salários, requisitos, benefícios ou condições.

O portal conserva a descrição completa. A prévia explica que a arte apresenta os destaques.

## Acesso e disponibilidade

`GET` (modelo automático) e `POST` (seleção do modal) em `/api/rh/vagas/[id]/postagem` exigem sessão Auth válida, `account_area = staff` e `has_permission('jobs.read', id)`, incluindo MFA obrigatório, conta ativa e escopo da vaga. A consulta usa o cliente do usuário e RLS; não usa service role. Candidato ou visitante não pode gerar a imagem, mesmo se a vaga é pública. Nenhum texto editado é persistido no cadastro.

O POST aceita somente JSON da origem servida ou do `APP_URL` confiável (para proxies com URL interna), com leitura limitada a 256 KiB mesmo sem Content-Length. Origens externas e requisições cross-site são recusadas. Zod estrito aceita apenas tipo de seção e os textos selecionados, confere quantidade, conteúdo não vazio e teto de 10.000 caracteres por item. Campos de título/link/metadados enviados pelo cliente são recusados. A consulta da vaga e a autorização se repetem em cada geração.

A vaga precisa estar `published`, com visibilidade `public` e prazo futuro ou sem prazo. Rascunhos, vagas internas, pausadas, encerradas e vencidas não liberam cópia/geração no RH; a API verifica novamente e devolve conflito se o estado mudou. O compartilhamento não publica nem altera a vaga.

O UUID e os dados consultados são validados com Zod. A renderização usa texto em JSX e ativos locais fixos; conteúdo da vaga não vira HTML, SVG fornecido pelo usuário ou endereço de imagem remota. Respostas usam `private, no-store` e `nosniff`; logs de erro não incluem texto da vaga ou dados pessoais. A imagem é criada em memória e descartada pelo servidor após a resposta. A prévia usa URL de objeto revogada ao fechar/trocar a tela.

## Vercel e publicação

A rota usa Node.js, `ImageResponse` do Next.js e Sharp já presentes nas dependências, com limite de execução de 30 segundos e limite de saída de 4 MiB. Os exemplos validados ficam abaixo de 1 MiB. Não exige navegador headless, escrita persistente, IA, Supabase Storage ou serviço de geração externo. O uso entra nas requisições/CPU normais da hospedagem; não há API adicional de imagem.

Fontes Inter e logo têm inclusão explícita no tracing do Next.js para a rota. A mesma geração deve funcionar no build standalone e no deploy nativo Vercel. Referência de limites: [Vercel Functions](https://vercel.com/docs/functions/limitations).

Publicar o código atualizado e confirmar que a variável **já existente** `APP_URL` aponta para o domínio público definitivo, acessível sem login da Vercel. O endereço não é montado a partir do host de previews ou de cabeçalhos enviados pelo cliente. Não há migration ou variável nova.

## Validação

- `npm run check`: lint, TypeScript, testes de modelo e build.
- `npm run test:e2e:job-promotion`: Supabase local, contas/vagas fictícias com limpeza, MFA e permissões reais; testa geração, download, dados salvos, clipboard/fallback, clique repetido, erro/nova tentativa, mobile, estados de publicação e acesso negado.
- `PROMOTION_TEST_URL=http://localhost:3000` permite executar o mesmo smoke contra o Docker local atualizado. O padrão inicia Next na porta 3001; o teste recusa bancos, Auth e servidores remotos.
- Capturas e PNGs para inspeção em `artifacts/job-promotion/`, ignorado pelo Git. Inspecionar as artes normal, longa e sem informações opcionais. O smoke confere também pixels de texto no destaque, título, contrato, conteúdo e link após gerações sucessivas, além dos metadados do PNG.
