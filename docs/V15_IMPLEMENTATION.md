# NOÉRION V15 — implementação e liberação

Fonte: `instruções para atualização/NOERION_SITE_V15/00_LEIA_PRIMEIRO.txt`, guia PDF V15 de 25/10/2026 e protótipo que o acompanha. A redação da parte 2 do PDF tem precedência sobre versões anteriores. Em 28/10/2026, o usuário autorizou explicitamente publicar a V15 e retirar a manutenção, substituindo o bloqueio anterior em `AGENTS.md`.

## O que foi aplicado

| Decisão V15 | Implementação |
| --- | --- |
| Identidade clara, editorial e sem efeitos ostensivos | Tokens marfim, linho, oliva e café; EB Garamond e Hanken Grotesk; sem sombras ou gradientes |
| Redação pessoal, sem preços públicos nem edição Signature | Texto do protótipo transcrito; CREFITO-11/362668-F e inscrição secundária CREFITO-3 |
| Sequência de conteúdo definida no guia | Topo → formato/manifesto → percurso → funcionamento → práticas → experiência/honorários → quem conduz → 12 perguntas → ingresso → rodapé |
| Cinco movimentos em português | Origem, Corpo, Mente, Consciência e Integração; TAA como Terapia de Autoabsorção |
| Uma chamada principal | “Solicitar uma conversa”, com destino `/conversa` |
| Tratamento das fotos | Três referências originais em WebP/JPG; tamanhos explícitos; hero prioritário; demais lazy; alt coerente com a imagem. Legendas visíveis removidas por solicitação explícita do usuário |
| Responsividade | Conteúdo até 1180px; margens 32/20px; seções 120–136/88px; listas e FAQ com uma coluna até 640px; cabeçalho móvel somente com marca |
| Acessibilidade | Conteúdo sem depender de JS; skip link; regiões e títulos; foco visível; alvos de 44px; labels e fieldsets; feedback de erro; respeito a movimento reduzido |
| Formulário em duas etapas | Avanço e retorno preservam respostas, validação cliente/servidor, privacidade obrigatória e comunicações opcionais desmarcadas |
| Envio e confirmação reais | `src/contact-service.mjs` prepara SMTP com TLS, validação, honeypot, limite de envios e deduplicação temporária; transporte real permanece desativado |
| Confirmação sem falso sucesso | “Recebido” só após HTTP de sucesso e `ok: true`; falhas preservam dados e identificador; campos bloqueados durante envio |
| Medição sem cookies | Integração Umami preparada em `analytics.js`, desativada; sem Pixel, eventos de formulário, identidade, referrer, query ou hash |
| Páginas separadas | `conversa.html`, `privacidade.html` e `termos.html`; links e canônicos usam rotas limpas |
| Não indexar conteúdo provisório | Todas as páginas com `noindex, nofollow, noarchive`; robots permite leitura dessas tags; sem sitemap enquanto fotos e jurídico estão pendentes |

O HTML, CSS e JavaScript estão separados em arquivos compartilhados. As imagens antigas não utilizadas saíram de `dist/` e foram preservadas localmente em `tmp/archive-v6-assets/`; a V6 também permanece no histórico do Git e na pasta de referência original. Não há referências à imagem `scan.jpg`, a iTeraCare ou a biorressonância no conteúdo V15.

## Publicação autorizada

`Dockerfile`, `.dockerignore`, `infra/nginx.conf`, `server.mjs`, `deploy.sh` e a documentação foram atualizados para a liberação. O Docker e o servidor local servem `dist/`. O Compose, o Traefik e as demais stacks foram preservados. `maintenance/` continua disponível apenas como alternativa de retorno, fora do diretório servido.

As rotas limpas `/conversa`, `/privacidade` e `/termos` estão configuradas, com redirecionamentos dos aliases `.html`. Rotas desconhecidas retornam 404 e `/api/conversa` responde 503 JSON, coerente com o formulário desativado. A ativação futura de SMTP exige integrar o serviço Node com controle de origem e proxy confiável; o container atual continua sendo estático em Nginx.

## Dependências externas ainda pendentes

1. **Contatos:** confirmar número do WhatsApp Business e e-mail profissional. Os dados de exemplo do pacote não foram considerados reais. Os links permanecem ocultos até configuração válida em `dist/site-config.js`.
2. **Fotografia:** substituir as três referências IA por fotos reais/autorizadas do ensaio previsto e aprovar o tratamento visual. `photosApproved` continua `false`.
3. **Jurídico:** receber do advogado o texto final de privacidade e termos, identificação fiscal/endereço do responsável, contato para direitos dos titulares, fornecedores/localização dos dados e foro. Os arquivos atuais são minutas claramente identificadas, não políticas aprovadas. `legalApproved` continua `false` e bloqueia o formulário.
4. **E-mail:** configurar SMTP/remetente/destinatário oficiais e testar entrega e confirmação com o provedor. Não foram solicitadas nem incluídas credenciais no código; usar ambiente seguro baseado em `.env.example`. O assunto e a mensagem de confirmação seguem o texto V15. `contactEnabled` e `CONTACT_ENABLED` continuam desativados.
5. **Operação de dados:** estabelecer o procedimento para excluir em seis meses as solicitações que não se tornarem atendimento, incluindo caixas de e-mail e cópias. A API não persiste formulários em banco, mas os e-mails ficam no provedor; a exclusão não está automatizada nem pode ser prometida antes de definir esse provedor/procedimento.
6. **Medição:** informar URL HTTPS do tracker Umami e identificador do site, confirmar versão/fornecedor na política e validar a coleta no lançamento. O carregador segue o [contrato oficial do Umami](https://docs.umami.is/docs/tracker-configuration), descarta eventos personalizados e restringe a medição às páginas conhecidas do domínio oficial. A integração não cria conta nem infraestrutura Umami.
7. **Ativação dos recursos pendentes:** a autorização de publicação já foi recebida. Completar os dados acima antes de ativar formulário e medição; integrar Node/proxy confiável e limites de borda antes de aceitar solicitações. Reavaliar a indexação após substituir as fotos e concluir o jurídico. `noindex` não controla acesso ao site.

## Verificações realizadas sem exibir a landing

`npm run check` valida sintaxe, links e arquivos locais, âncoras, metadados, textos/estrutura V15, flags desativadas e configuração da implantação autorizada. `npm test` verifica formulário em ambiente isolado, configuração de canais, sanitização de medição e API com e-mail simulado. Não foram enviados e-mails reais. A configuração de publicação também foi exercitada localmente nas páginas, rotas e respostas da API desativada.

A comparação offline do texto visível com o protótipo encontrou apenas a adição do link de acessibilidade “Pular para o conteúdo”. As três imagens WebP têm o mesmo conteúdo dos arquivos fornecidos.

Auditoria Lighthouse e testes em Safari/iPhone/Android reais permanecem sem comprovação. Não foi atribuído resultado de desempenho sem medição. O resultado efetivo da publicação deve ser confirmado pela ferramenta de hospedagem e pela resposta do domínio; um push no GitHub, isoladamente, não comprova atualização do servidor.
