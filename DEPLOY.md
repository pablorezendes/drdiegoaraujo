# Implantacao em drdiegoaraujo.com

O destino informado e `/srv/stack/drdiegoaraujo`. A landing page esta em `dist/` e e servida por um container Nginx independente. O Compose publica `127.0.0.1:8088`, acessivel apenas no servidor. Os comandos deste projeto nao alteram os containers do Hermerium.

## 1. Preparar o repositorio

Requisitos no servidor: Git, Docker com Compose v2 e curl. Execute com um usuario que tenha acesso ao Docker. Se o diretorio informado ja existe e esta vazio:

```bash
cd /srv/stack/drdiegoaraujo
git clone https://github.com/pablorezendes/drdiegoaraujo.git .
git switch main
bash deploy.sh
```

Se o diretorio ainda nao existir, crie-o antes com `mkdir -p /srv/stack/drdiegoaraujo`. Se ja contiver arquivos, revise-os antes de clonar. Nao remova arquivos existentes automaticamente. Se ja for um clone deste repositorio na branch `main`, basta executar `bash deploy.sh` nele.

O script exige a arvore Git limpa, atualiza `origin/main` com `git pull --ff-only`, constroi a imagem, inicia o servico `noerion` e verifica a resposta HTTP local. Nao e necessario Node.js no servidor. Um erro interrompe a implantacao e deve ser revisado antes de uma nova tentativa.

Validacao manual:

```bash
curl -I http://127.0.0.1:8088/
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail=50 noerion
```

Se a porta 8088 ja estiver em uso, escolha uma porta livre e use a mesma em todas as atualizacoes:

```bash
export NOERION_PORT=8089
bash deploy.sh
```

Ao trocar a porta, ajuste tambem `proxy_pass` no proxy reverso. O script usa `NOERION_PORT` exportada no shell e assume 8088 se ela estiver ausente; nao depende de uma porta definida apenas em `.env`.

## 2. Apontar o dominio e configurar o proxy

No provedor DNS, aponte `drdiegoaraujo.com` para o IP publico deste servidor. Configure `www.drdiegoaraujo.com` somente se esse endereco tambem for usado. Verifique registros AAAA antigos: eles precisam apontar para o mesmo servidor com IPv6 funcional ou ser corrigidos no provedor.

O arquivo `infra/drdiegoaraujo.nginx.conf.example` e um exemplo HTTP para um **Nginx instalado no host**. Antes de aplica-lo, confira como a stack existente recebe trafego nas portas 80 e 443 e se ja existe configuracao para este dominio. Se o proxy existente estiver em um container, o loopback dele nao e o loopback do host: adapte a integracao ao proxy atual antes de usar o exemplo. Nao inicie outro proxy nas mesmas portas.

Para um host que ja usa o layout `/etc/nginx/sites-available` e `/etc/nginx/sites-enabled`, e sem outro bloco ativo para este dominio, revise o exemplo e entao instale-o:

```bash
sudo cp infra/drdiegoaraujo.nginx.conf.example /etc/nginx/sites-available/drdiegoaraujo.conf
sudo ln -s /etc/nginx/sites-available/drdiegoaraujo.conf /etc/nginx/sites-enabled/drdiegoaraujo.conf
sudo nginx -t
sudo systemctl reload nginx
```

Se esses caminhos, o arquivo ou o link ja existirem, revise a configuracao existente e faca backup antes de editar; nao sobrescreva uma configuracao em uso. Em outros layouts, use o diretorio de inclusao do Nginx existente. Recarregue somente depois que `nginx -t` passar. O `deploy.sh` nao faz essas alteracoes.

Teste o roteamento HTTP, inclusive de uma conexao externa:

```bash
curl -I http://drdiegoaraujo.com/
```

## 3. Ativar HTTPS

Esta etapa depende do DNS propagado, do dominio respondendo por HTTP no servidor certo e do acesso publico as portas 80 e 443. Use o mecanismo de certificados do proxy existente. Para Nginx no host com Certbot e seu plugin Nginx ja instalados:

```bash
sudo certbot --nginx -d drdiegoaraujo.com -d www.drdiegoaraujo.com
sudo certbot renew --dry-run
curl -I https://drdiegoaraujo.com/
```

Inclua `www` no comando somente se o DNS dele tambem estiver configurado para este servidor. Ative o redirecionamento para HTTPS durante ou depois da emissao bem-sucedida do certificado. O exemplo inicia apenas em HTTP para permitir essa emissao. Se o provedor usa outro proxy ou gerenciador de certificados, mantenha o fluxo existente.

## Atualizacoes futuras

```bash
cd /srv/stack/drdiegoaraujo
bash deploy.sh
```

Exporte novamente `NOERION_PORT` antes do comando se usar uma porta diferente de 8088. Nao execute `docker compose down` em outra stack, nao use comandos de limpeza global do Docker e nao substitua configuracoes de proxy de outros dominios. A implantacao nao modifica firewall, DNS, certificados ou arquivos do Nginx no host.
