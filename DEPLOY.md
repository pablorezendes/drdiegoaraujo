# Implantação do NOÉRION V15

A publicação da landing completa foi autorizada expressamente pelo usuário. Docker e `server.mjs` agora servem `dist/`; a versão anterior de manutenção permanece preservada em `maintenance/`.

## Atualizar o servidor

```bash
cd /srv/stack/drdiegoaraujo
git pull --ff-only origin main
bash deploy.sh
```

O script exige Git limpo, atualiza `origin/main`, valida os arquivos V15, constrói a imagem e recria somente este projeto Compose. Confirma o título real e HTTP 200 na página inicial, `/conversa`, `/privacidade` e `/termos`, primeiro em `http://127.0.0.1:8088/` e depois em `https://drdiegoaraujo.com/`. Uma resposta antiga de manutenção não passa na verificação.

A integração existente do Traefik permanece: rede externa `proxy`, entrada `websecure`, resolver `le`, domínio `drdiegoaraujo.com` e porta interna 80. Não há reinício do proxy ou de outras stacks. Se a porta local 8088 estiver ocupada, exporte `NOERION_PORT` com uma porta livre antes de cada execução.

## Rotas e conteúdo

As rotas públicas são `/`, `/conversa`, `/privacidade` e `/termos`. Os aliases `.html` e barras finais nas páginas internas redirecionam para as rotas limpas com HTTP 308. Arquivos ausentes retornam 404; não há fallback geral para a página inicial. HTML, scripts e configuração usam revalidação de cache; imagens têm cache de uma hora. `noindex, nofollow, noarchive` continua ativo enquanto as pendências de lançamento são resolvidas.

O SMTP não está configurado nem habilitado. `/api/conversa` responde HTTP 503 com JSON `{ "ok": false, "message": "…" }`; não há confirmação falsa de recebimento. Habilitar o envio exige uma implantação própria do backend Node e as validações descritas em `docs/CONTACT.md`. O container público continua sendo apenas Nginx estático, sem credenciais SMTP.

## Diagnóstico

```bash
docker compose -f compose.yaml ps
curl -I http://127.0.0.1:8088/
curl -I https://drdiegoaraujo.com/conversa
curl -i https://drdiegoaraujo.com/api/conversa
docker compose -f compose.yaml logs --tail=50 noerion
```

Se a origem local responder V15 e o domínio ainda mostrar manutenção, confira o cache do Cloudflare e o roteamento do Traefik. O script verifica a resposta pública e informa falha enquanto ela não corresponder ao V15.

Para um clone inicial, use um diretório vazio e `git clone https://github.com/pablorezendes/drdiegoaraujo.git .`. Não remova arquivos existentes para conseguir clonar, não execute limpeza global de Docker e não altere os certificados ou a rede das outras stacks.
