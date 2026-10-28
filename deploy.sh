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

site_title='<title>Dr. Diego de Araújo · Fisioterapeuta — NOÉRION</title>'
if [[ ! -f dist/index.html ]] || ! grep -Fq -- "$site_title" dist/index.html; then
    printf 'ERRO: a pagina V15 nao foi encontrada ou seu titulo esta incorreto.\n' >&2
    exit 1
fi
for page in conversa privacidade termos; do
    if [[ ! -f "dist/${page}.html" ]]; then
        printf 'ERRO: dist/%s.html nao foi encontrada.\n' "$page" >&2
        exit 1
    fi
done

is_site_page() {
    local response response_code
    if ! response="$(curl --fail --silent --show-error --max-time 10 --write-out '\n%{http_code}' "$1")"; then
        return 1
    fi
    response_code="${response##*$'\n'}"
    [[ "$response_code" == 200 ]] && grep -Fq -- "${2:-$site_title}" <<< "$response"
}

verify_pages() {
    local base_url="$1"
    is_site_page "${base_url}conversa" '<title>Solicitar uma conversa · NOÉRION</title>' &&
        is_site_page "${base_url}privacidade" '<title>Política de Privacidade · NOÉRION</title>' &&
        is_site_page "${base_url}termos" '<title>Termos de uso · NOÉRION</title>'
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

printf 'Construindo e publicando o site V15 autorizado...\n'
if docker compose up --help | grep -q -- '--wait'; then
    docker compose -f compose.yaml up -d --build --wait
else
    docker compose -f compose.yaml up -d --build
fi

site_url="http://127.0.0.1:${NOERION_PORT}/"
local_ready=0
for attempt in {1..30}; do
    if is_site_page "$site_url" && verify_pages "$site_url"; then
        local_ready=1
        printf 'V15 e paginas internas confirmadas com HTTP 200 em %s\n' "$site_url"
        break
    fi
    sleep 2
done

if [[ "$local_ready" -ne 1 ]]; then
    printf 'ERRO: o site V15 e suas paginas internas nao foram confirmados em %s.\n' "$site_url" >&2
    docker compose -f compose.yaml ps
    docker compose -f compose.yaml logs --tail=50 noerion
    exit 1
fi

public_url='https://drdiegoaraujo.com/'
printf 'Verificando o site V15 na rota publica do Traefik...\n'
for attempt in {1..12}; do
    if is_site_page "$public_url" && verify_pages "$public_url"; then
        printf 'V15 publicado e paginas internas confirmadas com HTTP 200: %s\n' "$public_url"
        printf 'O envio de contato continua desativado ate configuracao SMTP.\n'
        exit 0
    fi
    sleep 2
done

printf 'ERRO: o V15 foi confirmado localmente, mas ainda nao foi confirmado em %s.\n' "$public_url" >&2
printf 'Confira o DNS de origem no Cloudflare e a rota drdiegoaraujo no Traefik (rede proxy, entrada websecure, resolver le).\n' >&2
exit 1
