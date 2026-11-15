#!/usr/bin/env bash
# Exercise deployment control flow with a fake Docker CLI; no daemon/database access.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/deployment"
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$DEPLOY_TEST_LOG"
if [[ $1 == inspect ]]; then
    if [[ $* == *Config.Image* ]]; then echo 'cod:previous';
    elif [[ $* == *State.Health* ]]; then
        if [[ $DEPLOY_TEST_FAILURE == health ]]; then echo 'running unhealthy'; else echo 'running healthy'; fi
    elif [[ $DEPLOY_TEST_FAILURE == scheduler ]]; then echo exited;
    else echo running; fi
    exit 0
fi
[[ $1 == compose ]] || exit 91
shift
while (( $# )); do
    case $1 in config|ps|pull|exec|stop|run|up) break ;; esac
    shift
done
case $1 in
    ps)
        if [[ $* == *'-q app' && $DEPLOY_TEST_FAILURE != missing ]]; then echo app-id;
        elif [[ $* == *'-q scheduler' ]]; then echo scheduler-id; fi ;;
    pull) [[ $DEPLOY_TEST_FAILURE != pull ]] || exit 21 ;;
    run) [[ $DEPLOY_TEST_FAILURE != migration ]] || exit 22 ;;
esac
MOCK
# The lock itself is provided by util-linux on the Linux deployment host.
cat > "$work/bin/flock" <<'MOCK'
#!/usr/bin/env bash
[[ $DEPLOY_TEST_FAILURE != lock ]]
MOCK
chmod +x "$work/bin/docker" "$work/bin/flock"
export PATH="$work/bin:$PATH"
export DEPLOY_TEST_LOG="$work/docker.log"
cd "$work/deployment"
for scenario in success missing pull migration health scheduler lock; do
    export DEPLOY_TEST_FAILURE=$scenario
    : > "$DEPLOY_TEST_LOG"
    status=0
    bash "$root/scripts/deploy.sh" -f compose.yaml > "$work/output" 2>&1 || status=$?
    if [[ $scenario == success ]]; then
        [[ $status == 0 ]]
        grep -q 'artisan migrate --force' "$DEPLOY_TEST_LOG"
        grep -q 'artisan up$' "$DEPLOY_TEST_LOG"
        # Migration must finish before new app starts; maintenance opens last.
        migrate_line=$(grep -n 'artisan migrate --force' "$DEPLOY_TEST_LOG" | cut -d: -f1)
        start_line=$(grep -n 'up -d --no-deps --force-recreate app$' "$DEPLOY_TEST_LOG" | cut -d: -f1)
        scheduler_line=$(grep -n 'up -d --no-deps --force-recreate scheduler$' "$DEPLOY_TEST_LOG" | cut -d: -f1)
        reopen_line=$(grep -n 'artisan up$' "$DEPLOY_TEST_LOG" | cut -d: -f1)
        (( migrate_line < start_line && start_line < scheduler_line && scheduler_line < reopen_line ))
    else
        [[ $status != 0 ]]
        ! grep -q 'artisan up$' "$DEPLOY_TEST_LOG"
        case $scenario in
            missing|pull|lock) ! grep -q 'artisan down' "$DEPLOY_TEST_LOG" ;;
            migration)
                ! grep -q 'up -d' "$DEPLOY_TEST_LOG"
                grep -q 'Maintenance remains enabled' "$work/output" ;;
        esac
    fi
    ! grep -Eq 'migrate:fresh|migrate:refresh|down -v|db:seed|volume rm' "$DEPLOY_TEST_LOG"
    echo "PASS deploy: $scenario"
done
# Also verify the repository template is selected explicitly when no options are passed.
export DEPLOY_TEST_FAILURE=success
: > "$DEPLOY_TEST_LOG"
bash "$root/scripts/deploy.sh" > "$work/output" 2>&1
grep -q 'compose --env-file .env.production -f compose.production.yaml config --quiet' "$DEPLOY_TEST_LOG"
echo 'PASS deploy: default Compose options'
