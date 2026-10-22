#!/usr/bin/env bash
set -Eeuo pipefail

trap 'printf "ERRO: implantacao interrompida na linha %s.\n" "$LINENO" >&2' ERR

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$REPO_DIR"

for command_name in git docker curl grep; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'ERRO: comando necessario nao encontrado: %s.\n' "$command_name" >&2
        exit 1
    fi
done

docker compose version >/dev/null
docker info >/dev/null

if [[ "$(git rev-parse --show-toplevel)" != "$REPO_DIR" ]]; then
    printf 'ERRO: este script deve estar na raiz do repositorio Git.\n' >&2
    exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
    printf 'ERRO: existem alteracoes locais. Revise e salve-as antes de atualizar.\n' >&2
    git status --short
    exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
    if git ls-remote --exit-code --heads origin refs/heads/main >/dev/null; then
        if [[ "$(git branch --show-current)" != main ]]; then
            printf 'ERRO: selecione a branch main antes de implantar.\n' >&2
            exit 1
        fi
        printf 'Atualizando origin/main...\n'
        git pull --ff-only origin main
    else
        remote_status=$?
        if [[ "$remote_status" -eq 2 ]]; then
            printf 'AVISO: origin/main nao existe. Usando os arquivos locais versionados.\n'
        else
            printf 'ERRO: nao foi possivel consultar origin/main. Verifique rede e acesso Git.\n' >&2
            exit "$remote_status"
        fi
    fi
else
    printf 'AVISO: remoto origin ausente. Usando os arquivos locais versionados.\n'
fi

maintenance_title='<title>Dr. Diego de Araújo — Site em manutenção</title>'
if [[ ! -f maintenance/index.html ]] || ! grep -Fq -- "$maintenance_title" maintenance/index.html; then
    printf 'ERRO: a pagina de manutencao obrigatoria nao foi encontrada ou seu titulo esta incorreto.\n' >&2
    printf 'A landing completa deve permanecer fora do ar ate nova autorizacao humana explicita.\n' >&2
    exit 1
fi

is_maintenance_page() {
    local response response_code
    if ! response="$(curl --fail --silent --show-error --max-time 10 --write-out '\n%{http_code}' "$1")"; then
        return 1
    fi
    response_code="${response##*$'\n'}"
    [[ "$response_code" == 200 ]] && grep -Fq -- "$maintenance_title" <<< "$response"
}

# A mesma porta e repassada ao Compose e usada na verificacao local.
# Para mudar a porta, exporte NOERION_PORT no shell antes de executar.
export NOERION_PORT="${NOERION_PORT:-8088}"
if [[ ! "$NOERION_PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$NOERION_PORT < 1 || 10#$NOERION_PORT > 65535 )); then
    printf 'ERRO: NOERION_PORT deve ser uma porta entre 1 e 65535.\n' >&2
    exit 1
fi

docker compose -f compose.yaml config --quiet

if ! docker network inspect proxy >/dev/null 2>&1; then
    printf 'ERRO: a rede externa proxy do Traefik nao foi encontrada neste servidor.\n' >&2
    printf 'Use a rede do proxy existente; nao crie outra rede isolada com o mesmo objetivo.\n' >&2
    exit 1
fi

printf 'Construindo e publicando somente a pagina de manutencao...\n'
if docker compose up --help | grep -q -- '--wait'; then
    docker compose -f compose.yaml up -d --build --wait
else
    docker compose -f compose.yaml up -d --build
fi

site_url="http://127.0.0.1:${NOERION_PORT}/"
local_ready=0
for attempt in {1..30}; do
    if is_maintenance_page "$site_url"; then
        local_ready=1
        printf 'Manutencao confirmada com HTTP 200 em %s\n' "$site_url"
        break
    fi
    sleep 2
done

if [[ "$local_ready" -ne 1 ]]; then
    printf 'ERRO: a pagina de manutencao com HTTP 200 nao foi confirmada em %s.\n' "$site_url" >&2
    docker compose -f compose.yaml ps
    docker compose -f compose.yaml logs --tail=50 noerion
    exit 1
fi

public_url='https://drdiegoaraujo.com/'
printf 'Verificando a pagina de manutencao na rota publica do Traefik...\n'
for attempt in {1..12}; do
    if is_maintenance_page "$public_url"; then
        printf 'Manutencao publicada e confirmada com HTTP 200: %s\n' "$public_url"
        printf 'A landing completa permanece fora do ar ate nova autorizacao humana explicita.\n'
        exit 0
    fi
    sleep 2
done

printf 'ERRO: a manutencao foi confirmada localmente, mas ainda nao foi confirmada em %s.\n' "$public_url" >&2
printf 'Confira o DNS de origem no Cloudflare e a rota drdiegoaraujo no Traefik (rede proxy, entrada websecure, resolver le).\n' >&2
exit 1
