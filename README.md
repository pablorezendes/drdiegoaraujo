# Dr. Diego de Araújo — site em manutenção

O conteúdo publicado em **https://drdiegoaraujo.com** deve exibir somente “Site em manutenção / Voltamos em breve”. A landing completa está preservada em `dist/` e permanece fora do ar até nova autorização humana explícita.

## Rodar localmente

Com Node.js 18 ou superior:

```sh
npm run dev
```

Abra `http://localhost:4173`. O `server.mjs` serve exclusivamente a pasta `maintenance/`; a variável `PORT` altera a porta. O Docker também inclui somente `maintenance/` no diretório público do Nginx.

## Implantar a manutenção

No servidor, o clone fica em `/srv/stack/drdiegoaraujo`. Execute `bash deploy.sh` para atualizar e implantar somente a manutenção. O script valida o título da página e confirma HTTP 200 no container local e no domínio público. Consulte [DEPLOY.md](DEPLOY.md).

## Conteúdo preservado

- `maintenance/`: única página autorizada para exibição.
- `dist/`: landing completa, imagens, estilos, formulário e configuração de contato, preservados sem publicação.
- `Dockerfile`, `compose.yaml`, `infra/`: serviço de manutenção ligado ao Traefik existente.
- `AGENTS.md`: instrução permanente de bloqueio da publicação da landing completa.

Não altere o diretório servido para `dist/` nem publique a landing em outra rota ou hospedagem até receber nova autorização humana explícita.
