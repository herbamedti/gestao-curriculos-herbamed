# Estado de entrega

| Área | Implementado | Validado aqui | Para produção |
| --- | --- | --- | --- |
| Portal e vagas | Home, busca, detalhe, SEO, candidatura; demo hospedada sem indexação | Build e navegação local | Revisão de conteúdo institucional |
| Candidato | Auth, Conta no menu Configurações, currículo estruturado, edição de trajetória, PDF sob demanda, candidatura com dados completos, privacidade e mensagens | Build, pgTAP e smoke local de conta/currículo/PDF/candidatura | Validação mobile e acessibilidade assistiva |
| RH | Vagas, pipeline, cadastro e edição integral do currículo estruturado, vínculo manual com vaga, currículo em tela e PDF, entrevistas, avaliações, mensagens, usuários, permissões, indicadores, auditoria e Conta com preferência MFA pessoal | Build; pgTAP para permissão/MFA, edição e vínculo; smoke local de conta e alternância MFA | OAuth real, escopo e testes de carga |
| Segurança | RLS, RBAC, MFA e códigos de confirmação por e-mail para a Conta; PDF autorizado e auditado; Storage, worker e antivírus preservados e desativados no fluxo padrão; código de e-mail por RPC sem conexão SQL na Vercel; e-mail e Turnstile opcionais e desativados em demo, com quota de cadastro | pgTAP, smoke de Conta e stack local reduzida | Gateway de Auth para impor step-up em todas as mutações de credenciais, pentest, WAF, alertas e backup |
| LGPD | Aviso versionado com publicação pelo RH autorizado, escolha de talentos, pedidos, exportação | Migrações e publicação local | Aviso/base/retensão jurídicos, workflow de exclusão |
| Comunicação | Central, notificações em tela e SMTP para Conta; outbox operacional preservada sem worker no deploy Vercel | Stack local | Provedor transacional, testes de entrega real e worker se envio operacional for necessário |
| Deploy | Build Next.js nativo da Vercel, `Dockerfile.vercel` histórico arquivado fora da raiz para evitar autodetecção de contêiner, validação de variáveis, health check, migrations sem seed e bootstrap Azure ou senha/TOTP por conta | Build e testes locais; 80 testes pgTAP; smoke demo sem e-mail; migration aplicada no projeto hospedado e login do primeiro Superadministrador validado, com MFA ativo | Domínio, smoke da aplicação na Vercel e reativação futura de SMTP/Turnstile |

O primeiro deploy deve usar `APP_ENV=demo` e somente dados fictícios. Este repositório ainda não deve receber currículos reais nem ser anunciado como produção operacional sem os itens da última coluna.
