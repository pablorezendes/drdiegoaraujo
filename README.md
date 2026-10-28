# Dr. Diego de Araújo — NOÉRION V15

A publicação da V15 e a retirada da manutenção foram explicitamente autorizadas pelo usuário em 28/10/2026. O conteúdo publicado vem de `dist/`. O envio do formulário continua desativado até configuração do e-mail e aprovação jurídica.

## Rodar localmente

Com Node.js 20 ou superior:

```sh
npm run dev
```

Abra `http://localhost:4173`. O `server.mjs` serve a pasta `dist/`, com as rotas `/conversa`, `/privacidade` e `/termos`; a variável `PORT` altera a porta. O Docker também inclui somente `dist/` no diretório público do Nginx. A API de contato responde indisponível enquanto o envio não está configurado.

## Implantar a V15

No servidor, o clone fica em `/srv/stack/drdiegoaraujo`. Execute `git pull --ff-only origin main` e `bash deploy.sh` para atualizar e implantar a V15. O script valida a página inicial, as rotas e o bloqueio de envio. Consulte [DEPLOY.md](DEPLOY.md).

## Conteúdo preservado

- `maintenance/`: página preservada para eventual retorno à manutenção.
- `dist/`: landing V15, imagens, estilos, formulário e configuração de contato.
- `src/contact-service.mjs`: serviço de contato SMTP preparado e desativado; não está ligado ao servidor estático.
- `docs/V15_IMPLEMENTATION.md`: mapa da refatoração V15, verificações e pendências do guia.
- `Dockerfile`, `compose.yaml`, `infra/`: V15 ligada ao Traefik existente.
- `AGENTS.md`: registro da autorização de publicação e dos dados ainda pendentes.

Contatos oficiais, fotos reais, configurações de e-mail e textos jurídicos finais continuam pendentes. Os avisos e o bloqueio de envio não devem ser removidos sem esses dados. A versão atual permanece com `noindex` por conter material provisório.

## Conferir a V15 sem publicá-la

```sh
npm ci
npm run check
npm test
```

As verificações analisam os arquivos e usam transporte de e-mail simulado. Os testes HTTP exercitam somente a API de teste em loopback. Não há servidor da landing completa nem envio de e-mails reais. Consulte [docs/CONTACT.md](docs/CONTACT.md) para o contrato do formulário.
