#!/usr/bin/env bash
# Reproducible production deploy, run ON THE VPS (via SSH from the GitHub Actions
# workflow at .github/workflows/deploy.yml). Requires:
#   - repo checked out at REPO_DIR (see README.md deployment guide)
#   - Node/pnpm, and both Python venvs (interface_API/.venv, services/.venv) already set up
#   - systemd units life-api / life-whisper / life-web already installed
#   - passwordless sudo for `systemctl restart life-api|life-whisper|life-web`
#     for the deploy user (see README.md)
#
# Usage: deploy.sh <git-sha-or-ref>
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/life-regime-tracker}"
TARGET_REF="${1:?Usage: deploy.sh <git-sha-or-ref>}"
LOCK_FILE="/tmp/life-regime-deploy.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deploy is already running (lock: $LOCK_FILE). Exiting."
  exit 1
fi

cd "$REPO_DIR"

PREVIOUS_SHA="$(git rev-parse HEAD)"
echo "Current commit: $PREVIOUS_SHA"
echo "Deploying:      $TARGET_REF"

restart_services() {
  sudo systemctl restart life-api
  sudo systemctl restart life-whisper
  sudo systemctl restart life-web
}

health_check() {
  sleep 3
  curl -fsS http://127.0.0.1:8000/api/health >/dev/null
  curl -fsS http://127.0.0.1:8001/health >/dev/null
  curl -fsS http://127.0.0.1:3000 >/dev/null
}

rollback() {
  trap - ERR
  echo "Deploy failed — rolling back code to $PREVIOUS_SHA."
  echo "NOTE: database migrations are NOT reverted automatically; check prisma/migrations manually if this deploy applied any."
  git checkout --quiet "$PREVIOUS_SHA"
  pnpm install --frozen-lockfile
  pnpm prisma generate
  pnpm build
  restart_services
  echo "Rollback complete. Previous commit ($PREVIOUS_SHA) is running again."
  exit 1
}
trap rollback ERR

git fetch --quiet origin
git checkout --quiet "$TARGET_REF"

pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build

if ! git diff --quiet "$PREVIOUS_SHA" "$TARGET_REF" -- interface_API/requirements.txt; then
  echo "interface_API/requirements.txt changed, reinstalling."
  interface_API/.venv/bin/pip install -r interface_API/requirements.txt
fi

if ! git diff --quiet "$PREVIOUS_SHA" "$TARGET_REF" -- services/requirements.txt; then
  echo "services/requirements.txt changed, reinstalling."
  services/.venv/bin/pip install -r services/requirements.txt
fi

restart_services

if ! health_check; then
  echo "Health check failed after deploying $TARGET_REF."
  rollback
fi

trap - ERR
echo "Deploy of $TARGET_REF succeeded and passed health checks."
