# Implantação em drdiegoaraujo.com

O servidor usa **Traefik** nas portas 80/443. A landing page é servida pelo Nginx do seu próprio container, conectado à rede externa do Traefik.

Configuração confirmada no servidor:

- Diretório: `/srv/stack/drdiegoaraujo`.
- Rede externa: `proxy`.
- Entrada HTTPS: `websecure`.
- Resolver de certificados: `le`.
- Serviço da landing page: `noerion`, porta interna `80`.
- Verificação local: `http://127.0.0.1:8088/`.
- Domínio publicado: `https://drdiegoaraujo.com/`.

## Atualizar e corrigir o domínio

No clone existente, execute:

```bash
cd /srv/stack/drdiegoaraujo
git pull --ff-only origin main
bash deploy.sh
```

O Compose conecta o serviço à rede `proxy` e registra a rota HTTPS `drdiegoaraujo` por meio das labels do Traefik. Não é necessário instalar Nginx no host, executar Certbot ou reiniciar o Traefik. Os serviços das outras stacks não são recriados.

O script exige a árvore Git limpa, atualiza `origin/main`, valida a rede externa, constrói a imagem e inicia este projeto. Depois verifica o container local e confirma o título da landing page pelo domínio público. Se a página pública não responder, ele informa que a validação externa falhou, mesmo se o container estiver saudável.

## Primeira instalação

Requisitos: Git, curl, Docker com Compose v2 e acesso ao Docker. O Traefik deve estar ativo na rede `proxy`, com a entrada `websecure` e o resolver `le` configurados.

Em um diretório vazio:

```bash
mkdir -p /srv/stack/drdiegoaraujo
cd /srv/stack/drdiegoaraujo
git clone https://github.com/pablorezendes/drdiegoaraujo.git .
bash deploy.sh
```

Não remova arquivos de um diretório já preenchido para conseguir clonar; use o clone existente ou revise seu conteúdo.

## DNS e Cloudflare

O registro de origem de `drdiegoaraujo.com` deve apontar para este servidor. O Traefik solicita o certificado por meio do resolver `le` que já existe na stack. Se o domínio estiver no Cloudflare, use o modo SSL/TLS compatível com o HTTPS da origem; com certificado válido na origem, o modo recomendado é **Full (strict)**.

Esta configuração publica somente o domínio informado, `drdiegoaraujo.com`. O alias `www` precisa de DNS e de uma regra de roteamento próprios se for adicionado depois. O Compose não altera DNS, configurações do Cloudflare, certificados de outros domínios ou o proxy global.

## Diagnóstico

```bash
cd /srv/stack/drdiegoaraujo
docker compose -f compose.yaml ps
curl -I http://127.0.0.1:8088/
curl -I https://drdiegoaraujo.com/
docker compose -f compose.yaml logs --tail=50 noerion
```

- Local `200` e domínio `404`: confira a versão do Compose e as labels/rede da rota no Traefik.
- Domínio `502` ou `504`: confira a conexão do serviço e do Traefik à rede `proxy`, a saúde do container e a porta interna `80`.
- Erro de certificado: confira o resolver `le`, a origem DNS e o modo SSL/TLS do Cloudflare.

As labels podem ser conferidas sem exibir variáveis de ambiente:

```bash
docker inspect drdiegoaraujo-noerion-1 --format 'rede={{index .Config.Labels "traefik.docker.network"}} entrada={{index .Config.Labels "traefik.http.routers.drdiegoaraujo.entrypoints"}} resolver={{index .Config.Labels "traefik.http.routers.drdiegoaraujo.tls.certresolver"}}'
```

A porta local pode ser alterada exportando `NOERION_PORT` antes do script. Isso não altera a porta interna `80` usada pelo Traefik.

Referência: [configuração de roteamento Docker do Traefik](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/).
