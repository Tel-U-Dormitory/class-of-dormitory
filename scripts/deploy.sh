#!/usr/bin/env bash
# Run from the deployment directory; arguments are Docker Compose global options.
set -Eeuo pipefail
umask 077

if [[ ${1:-} == --help ]]; then
    echo 'Usage: bash scripts/deploy.sh [--env-file .env.production -f compose.yaml ...]'
    echo 'Default: --env-file .env.production -f compose.production.yaml'
    echo 'Updates an existing installation. Back up database/uploads first.'
    exit 0
fi
if (( $# == 0 )); then
    set -- --env-file .env.production -f compose.production.yaml
fi
compose_options=("$@")
dc() { docker compose "${compose_options[@]}" "$@"; }

# Keep the lock file: removing it would allow overlapping locks on different inodes.
exec 9>.cod-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
maintenance_started=false
on_exit() {
    local status=$?
    if (( status != 0 )); then
        echo 'Deployment failed. No automatic database rollback was attempted.' >&2
        if [[ $maintenance_started == true ]]; then
            echo 'Maintenance remains enabled; app/scheduler may be stopped. Diagnose before reopening.' >&2
        fi
    fi
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

dc config --quiet
app_id=$(dc ps -q app)
[[ -n $app_id ]] || { echo 'No running app in this Compose project. Check project/file; use the first-install guide for a new deployment.' >&2; exit 1; }
echo 'Previous image (save for rollback):'
docker inspect --format '{{.Config.Image}}' "$app_id"

# Pull before downtime. Only CoD services are targeted; never start/update MySQL.
dc pull app scheduler
maintenance_started=true
dc exec -T --user www-data app php artisan down --retry=60
# Drain existing web requests and stop scheduled writes before changing the schema.
dc stop app scheduler
dc run --rm --no-deps -T app php artisan migrate --force

dc up -d --no-deps --force-recreate app
app_id=$(dc ps -q app)
[[ -n $app_id ]] || { echo 'New app container was not found.' >&2; exit 1; }
healthy=false
for (( attempt=0; attempt<60; attempt++ )); do
    state=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$app_id")
    case "$state" in
        'running healthy') healthy=true; break ;;
        'running starting') sleep 2 ;;
        *) echo "App is not healthy: $state" >&2; exit 1 ;;
    esac
done
[[ $healthy == true ]] || { echo 'App health check timed out after 120 seconds.' >&2; exit 1; }
# /up checks boot only; also verify connectivity to the migrated database.
dc exec -T --user www-data app php artisan migrate:status
dc up -d --no-deps --force-recreate scheduler
scheduler_id=$(dc ps -q scheduler)
[[ -n $scheduler_id ]] || { echo 'Scheduler container was not found.' >&2; exit 1; }
[[ $(docker inspect --format '{{.State.Status}}' "$scheduler_id") == running ]] || {
    echo 'Scheduler is not running.' >&2; exit 1;
}
dc exec -T --user www-data app php artisan up
maintenance_started=false
dc ps
echo 'Deployment complete. Check HTTPS, login, photo uploads, and scheduler logs.'
