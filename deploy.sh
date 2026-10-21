#!/usr/bin/env bash
set -Eeuo pipefail

trap 'printf "ERRO: implantacao interrompida na linha %s.\n" "$LINENO" >&2' ERR

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$REPO_DIR"

for command_name in git docker curl; do
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

if [[ ! -f dist/index.html ]]; then
    printf 'ERRO: dist/index.html nao foi encontrado. Verifique os arquivos do repositorio.\n' >&2
    exit 1
fi

# A mesma porta e repassada ao Compose e usada na verificacao local.
# Para mudar a porta, exporte NOERION_PORT no shell antes de executar.
export NOERION_PORT="${NOERION_PORT:-8088}"
if [[ ! "$NOERION_PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$NOERION_PORT < 1 || 10#$NOERION_PORT > 65535 )); then
    printf 'ERRO: NOERION_PORT deve ser uma porta entre 1 e 65535.\n' >&2
    exit 1
fi

docker compose -f compose.yaml config --quiet

printf 'Construindo e iniciando somente o projeto drdiegoaraujo...\n'
if docker compose up --help | grep -q -- '--wait'; then
    docker compose -f compose.yaml up -d --build --wait
else
    docker compose -f compose.yaml up -d --build
fi

site_url="http://127.0.0.1:${NOERION_PORT}/"
for attempt in {1..30}; do
    if curl --fail --silent --show-error --max-time 5 "$site_url" >/dev/null 2>&1; then
        printf 'Implantacao concluida. Landing page disponivel em %s\n' "$site_url"
        printf 'O dominio publico depende do proxy reverso e do certificado descritos em DEPLOY.md.\n'
        exit 0
    fi
    sleep 2
done

printf 'ERRO: a landing page nao respondeu em %s.\n' "$site_url" >&2
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail=50 noerion
exit 1
