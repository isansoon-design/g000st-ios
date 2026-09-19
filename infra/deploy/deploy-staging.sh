#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

readonly DEPLOY_USER="g000st-deploy"
readonly ARTIFACT_ROOT="/home/${DEPLOY_USER}/artifacts"
readonly STAGING_ORIGIN="https://staging.g000st.com"

target="${1:-}"
release_id="${2:-}"
artifact="${3:-}"

case "$target" in
  web)
    base_dir="/root/staging/g000st-web"
    process_name="g000st-web-staging"
    local_health_url="http://127.0.0.1:3001/login"
    public_health_url="${STAGING_ORIGIN}/login"
    ;;
  api)
    base_dir="/root/staging/g000st-api"
    process_name="g000st-api-staging"
    local_health_url="http://127.0.0.1:3100/api/v1/health"
    public_health_url="${STAGING_ORIGIN}/api/v1/health"
    ;;
  *)
    printf 'Unsupported deployment target: %s\n' "$target" >&2
    exit 2
    ;;
esac

if [[ ! "$release_id" =~ ^[0-9]+-[0-9]+-[0-9a-f]{7,40}$ ]]; then
  printf 'Invalid release identifier.\n' >&2
  exit 2
fi

readonly expected_artifact="${ARTIFACT_ROOT}/g000st-${target}-${release_id}.tar.gz"
if [[ "$artifact" != "$expected_artifact" || ! -f "$artifact" || -L "$artifact" ]]; then
  printf 'Invalid deployment artifact.\n' >&2
  exit 2
fi

if [[ "$(stat -c '%U' "$artifact")" != "$DEPLOY_USER" ]]; then
  printf 'Deployment artifact has an unexpected owner.\n' >&2
  exit 2
fi

archive_entries="$(tar -tzf "$artifact")"
if grep -Eq '(^/|(^|/)\.\.(/|$)|(^|/)\.env($|\.))' <<<"$archive_entries"; then
  printf 'Deployment artifact contains a forbidden path.\n' >&2
  exit 2
fi

readonly releases_dir="${base_dir}/releases"
readonly current_link="${base_dir}/current"
readonly release_dir="${releases_dir}/${release_id}"

if [[ -e "$release_dir" ]]; then
  printf 'Release already exists: %s\n' "$release_id" >&2
  exit 2
fi

previous_release=""
activated=false

start_or_restart_process() {
  if pm2 describe "$process_name" >/dev/null 2>&1; then
    pm2 restart "$process_name" --update-env
    return
  fi

  case "$target" in
    api)
      pm2 start "$current_link/dist/server.js" \
        --name "$process_name" \
        --cwd "$current_link"
      ;;
    web)
      pm2 start npm \
        --name "$process_name" \
        --cwd "$current_link" \
        -- start --workspace @g000st/web -- --hostname 127.0.0.1 --port 3001
      ;;
  esac
}

rollback() {
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "$current_link"
    start_or_restart_process >/dev/null
    pm2 save >/dev/null
    printf 'Rolled back %s to %s\n' "$target" "$previous_release" >&2
  fi
}

on_error() {
  local exit_code=$?
  trap - ERR

  if [[ "$activated" == true ]]; then
    rollback || true
  fi

  if [[ -d "$release_dir" && "$(readlink -f "$current_link" 2>/dev/null || true)" != "$release_dir" ]]; then
    rm -rf "$release_dir"
  fi

  exit "$exit_code"
}

cleanup() {
  rm -f "$artifact"
}

wait_for_url() {
  local url="$1"
  local attempt

  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error --output /dev/null "$url"; then
      return 0
    fi
    sleep 1
  done

  printf 'Health check failed: %s\n' "$url" >&2
  return 1
}

trap on_error ERR
trap cleanup EXIT

mkdir -p "$releases_dir" "$release_dir"
tar --extract --gzip --file "$artifact" --directory "$release_dir" \
  --no-same-owner --no-same-permissions

test -f "$release_dir/package.json"
test -f "$release_dir/package-lock.json"

if [[ "$target" == web ]]; then
  test -f "$base_dir/shared/.env.production"
  test -f "$release_dir/apps/web/package.json"
  ln -s "$base_dir/shared/.env.production" "$release_dir/apps/web/.env.production"

  cd "$release_dir"
  npm ci --workspace @g000st/web --include-workspace-root --no-audit --no-fund
  npm run typecheck --workspace @g000st/web
  npm run build --workspace @g000st/web
else
  test -f "$base_dir/shared/.env"
  test -f "$release_dir/apps/api/package.json"
  ln -s "$base_dir/shared/.env" "$release_dir/.env"

  cd "$release_dir"
  npm ci --workspace @g000st/api --include-workspace-root --no-audit --no-fund
  npm run typecheck --workspace @g000st/api
  npm test --workspace @g000st/api
  npm run build --workspace @g000st/api
  ln -s apps/api/dist "$release_dir/dist"
fi

previous_release="$(readlink -f "$current_link")"
test -d "$previous_release"

ln -sfn "$release_dir" "$current_link"
activated=true
start_or_restart_process

wait_for_url "$local_health_url"
wait_for_url "$public_health_url"

if [[ "$target" == api ]]; then
  cd "$release_dir"
  SMOKE_API_BASE_URL="${STAGING_ORIGIN}/api/v1" node apps/api/scripts/staging-smoke.mjs
fi

pm2 save
activated=false
trap - ERR
printf 'Deployed %s release %s successfully.\n' "$target" "$release_id"
