# Retorno visual das operações

As áreas de candidato e RH mantêm o menu disponível durante a navegação. O link acionado mostra um indicador, uma barra no topo sinaliza a espera e a área de conteúdo fica suavemente desfocada. Durante esse intervalo, `inert` impede mouse e teclado de acionarem controles da página anterior. Outra opção do menu continua acessível.

`src/ui/link.tsx` mantém o Link do Next.js e usa `useLinkStatus` para acompanhar a navegação real, incluindo abas e paginação. Prefetch, abrir em outra aba e links instantâneos seguem o comportamento do framework; não há atraso artificial. A limpeza do estado de cada link evita manter o carregamento após a navegação terminar ou ser substituída. Indicadores animados só existem enquanto há uma operação em andamento.

Os arquivos `loading.tsx` do RH e candidato mostram um estado de espera dentro do layout, preservando o menu. O fallback da aplicação também usa a mesma linguagem visual. Eles cobrem a espera por conteúdo no servidor e navegações sem um link previamente acionado.

Formulários mostram indicador e texto no botão, desabilitando novos envios enquanto a ação está pendente. `ActionForm` também trava imediatamente a submissão e acompanha o redirecionamento; uma falha libera nova tentativa. Login, cadastro, recuperação, candidatura, salvamento, OAuth, MFA e saída usam esse retorno. As buscas usam Next Form e mantêm o botão em espera durante a troca dos resultados.

PDF, CSV e JSON usam `DownloadButton`: o botão mostra “Preparando arquivo…”, impede downloads repetidos simultâneos, verifica o tipo de resposta e informa sucesso ou falha. A espera pelo arquivo tem limite de 60 segundos; os endpoints continuam exigindo sessão e autorização. O PDF usado pelo candidato e gestor permanece o mesmo.

Adições, remoções e ordenações feitas apenas em memória continuam imediatas. A tela de erro mostra espera ao tentar carregar novamente. Estados de espera usam textos em pt-BR, `aria-busy`, mensagens de status e respeitam a preferência de movimento reduzido.

## Publicação e verificação

Não há migrations, variáveis de ambiente nem alterações de permissões nesta entrega. Publique o código atualizado na Vercel pelo fluxo habitual. Localmente, reconstrua somente a aplicação: `docker compose up -d --build app`.

Após `npm run check`, execute `npm run test:e2e:loading`. O smoke inicia Next na porta 3001 e exige Supabase/banco locais. Usa contas fictícias removidas ao terminar, MFA real com TOTP local e lentidão/falhas simuladas somente no navegador de teste. Verifica menus desktop/mobile, abas, navegação substituída, botões desabilitados e ausência de submissões duplicadas, retry, filtros, PDF/JSON/CSV e saída. Capturas ficam em `artifacts/loading-feedback`, ignorado pelo Git. Não rode ao mesmo tempo que outro smoke da porta 3001.

O retorno visual torna a espera perceptível; não representa uma medição ou correção da latência do Supabase/Vercel.
