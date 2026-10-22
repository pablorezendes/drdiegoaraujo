# Implantar somente a manutenção

O usuário autorizou apenas “Site em manutenção / Voltamos em breve”. A landing completa está preservada em `dist/` e deve permanecer fora do ar até nova autorização humana explícita. Docker e `server.mjs` servem `maintenance/`; nenhum arquivo de `dist/` entra no diretório público do container.

## Atualizar o servidor

No clone existente:

```bash
cd /srv/stack/drdiegoaraujo
git pull --ff-only origin main
bash deploy.sh
```

O script exige a árvore Git limpa, atualiza `origin/main`, valida `maintenance/index.html` e seu título, constrói a imagem e inicia somente este projeto. Depois confirma a página de manutenção e HTTP 200 tanto em `http://127.0.0.1:8088/` quanto em `https://drdiegoaraujo.com/`. Um container saudável sem a manutenção no domínio público é tratado como falha da implantação.

O servidor usa o Traefik existente, pela rede externa `proxy`, entrada `websecure` e resolver `le`. O Compose não reinicia o Traefik nem modifica outras stacks, DNS ou certificados. Não instale outro proxy nas portas 80/443. Se a porta local 8088 estiver ocupada, exporte `NOERION_PORT` com uma porta livre antes de cada execução do script.

## Primeira instalação

Requisitos: Git, curl, Docker com Compose v2 e Traefik já ativo com a configuração acima. Em um diretório vazio:

```bash
mkdir -p /srv/stack/drdiegoaraujo
cd /srv/stack/drdiegoaraujo
git clone https://github.com/pablorezendes/drdiegoaraujo.git .
bash deploy.sh
```

Use o clone existente se o diretório já contiver o repositório. Não remova arquivos para conseguir clonar. O domínio deve apontar para o servidor; o alias `www` não está configurado neste Compose.

## Verificar

```bash
docker compose -f compose.yaml ps
curl -sS http://127.0.0.1:8088/
curl -sS https://drdiegoaraujo.com/
docker compose -f compose.yaml logs --tail=50 noerion
```

As duas respostas devem conter `<title>Dr. Diego de Araújo — Site em manutenção</title>`. Se apenas o domínio divergir, confira DNS, cache e roteamento do Traefik antes de declarar a manutenção publicada.

Não restaure o diretório servido para `dist/` nem publique a landing completa em outra rota ou hospedagem sem nova autorização humana explícita.
