# Pré-solicitação de conversa V15

`src/contact-service.mjs` prepara o envio real por SMTP, mas não está ligado ao `server.mjs` nem ao Docker estático. Requer Node.js 20 ou superior e Nodemailer 10.2.1, fixado no lockfile. A publicação da landing foi autorizada explicitamente em 28/10/2026; o envio permanece desativado por falta de configuração SMTP e aprovação jurídica.

## Contrato para a integração futura

O módulo exporta `createContactService({ enabled, env, transport?, getClientIp? })`, com `handle(req, res)` para Node HTTP e `submit(payload, { ip })` para testes. `handle` retorna `false` em outras rotas. A ativação exige simultaneamente `enabled: true` no código de integração, `CONTACT_ENABLED=true` e toda a configuração SMTP e de origem válida. Instanciar o serviço não abre conexões SMTP. Os servidores estáticos atuais respondem 503 JSON em `/api/conversa` e não montam esse serviço.

`POST /api/conversa` recebe JSON de até 16 KiB, com `Content-Type: application/json` e cabeçalho `Origin` exatamente igual a uma origem autorizada. Não aceita formulário multipart, compressão, campos adicionais ou dados de saúde.

```json
{
  "requestId": "89d3e585-9788-4ec7-86a3-331835d557d5",
  "para": "mim",
  "interesse": "inteiro",
  "origem": "outro",
  "indicacao": "",
  "cidade": "Brasília",
  "valor": "entender",
  "nome": "Pessoa solicitante",
  "email": "pessoa@example.com",
  "whatsapp": "5561999999999",
  "horario": "tarde",
  "privacidade": true,
  "comunicacoes": false,
  "site": ""
}
```

- `requestId`: UUID criado com `crypto.randomUUID()` antes do primeiro envio. Reutilize o mesmo UUID e os mesmos dados em repetição de rede; crie outro somente quando o usuário iniciar uma nova solicitação ou editar os dados.
- `para`: `mim`, `proximo`, `presente`; `interesse`: `corpo`, `mente`, `espiritual`, `inteiro`.
- `origem`: `indicacao`, `outro`; `indicacao` é opcional, até 120 caracteres; `cidade`, obrigatória, até 120; `nome`, até 160.
- `valor`: `sim`, `entender`; `horario`: `manha`, `tarde`, `noite`.
- `email`: endereço simples até 254 caracteres; `whatsapp`: string de 10 a 15 dígitos, normalizada pelo frontend antes do envio.
- `privacidade` deve ser `true`; `comunicacoes`, booleano independente; `site`, honeypot, deve estar vazio.

Sucesso: HTTP 200, `{ "ok": true, "acknowledgementSent": true }`. Só ocorre depois que o SMTP aceita a mensagem destinada à equipe. O frontend só então mostra “Recebido. Retornamos em até 2 dias úteis para marcar uma conversa. O envio não garante vaga.”

Se a equipe recebeu e apenas a confirmação ao cliente falhou, retorna HTTP 200 com `acknowledgementSent: false`: o frontend pode mostrar o mesmo recebimento e não deve reenviar o lead. Em erro, retorna `{ "ok": false, "message": "…" }`: 400 para dados inválidos, 403 para origem, 405 para método, 408 para leitura lenta, 409 para reutilização de UUID com dados diferentes, 413 para tamanho, 415 para formato, 429 para limite e 503 para serviço desativado/configuração ausente/falha SMTP. Nunca há sucesso simulado.

## SMTP, consentimento e privacidade

Use `.env.example` apenas como modelo. O processo Node deve receber as variáveis pelo ambiente seguro da implantação; o módulo não carrega `.env` automaticamente. Configure `CONTACT_ALLOWED_ORIGINS` com origens HTTPS separadas por vírgula, sem barra final, e-mail da equipe, remetente autorizado e `CONTACT_PRIVACY_VERSION` da política aprovada. Origens HTTP são aceitas somente em loopback para testes. Não envie credenciais por chat nem versione `.env`.

`SMTP_SECURE=true` usa TLS direto; `false`, STARTTLS obrigatório. A validação do certificado permanece ativa, com TLS mínimo 1.2. Os logs e o modo debug do Nodemailer estão desligados. As mensagens são texto puro, sem anexos nem leitura de arquivos/URLs.

O e-mail da equipe inclui as respostas e os registros de horário UTC gerados pelo servidor: recebimento, declaração de leitura/aceite da política, versão da política e escolha separada de comunicações. O cliente recebe a confirmação somente após aceitação da equipe. O código não grava formulários, IPs, credenciais nem conteúdo SMTP em arquivos, banco, logs ou armazenamento do navegador. As caixas de e-mail do provedor passam a conter os dados: definir retenção, acesso e tratamento pela equipe antes da ativação.

## Limites operacionais

O limite padrão é 5 novas tentativas por IP em 10 minutos, por processo, com capacidade limitada. O IP padrão vem apenas de `req.socket.remoteAddress`, sem confiar em `X-Forwarded-For`. Atrás do Traefik, a integração futura precisa fornecer `getClientIp(req)` com validação explícita do proxy confiável e aplicar também limites no proxy; não use um cabeçalho arbitrário enviado pelo visitante. Nenhuma configuração de confiança foi ativada neste trabalho.

A idempotência mantém UUID, HMAC das respostas, promessa em andamento e resultado por 10 minutos, em memória e sem guardar o formulário. Envios simultâneos com o mesmo UUID/dados compartilham o resultado, inclusive falhas SMTP e de confirmação. `Message-ID` determinístico ajuda a identificar repetições, mas não garante deduplicação no provedor. Reinício, múltiplas réplicas, expiração ou perda de resposta SMTP podem exigir uma solução persistente de idempotência antes de ampliar a implantação; não há promessa de entrega exatamente uma vez. O recebimento SMTP também não garante entrega na caixa de entrada ou vaga.

## Verificação sem publicar

```sh
npm test
npm run check
```

Os testes usam transporte injetado e servidor HTTP restrito a loopback; não enviam e-mails reais. Antes de ativar o contato, validar credenciais e remetente no provedor, destinatário oficial, política/termos aprovados, consentimentos e integração do proxy. A autorização de publicação da landing já foi recebida; os dados necessários para habilitar o contato continuam pendentes.
