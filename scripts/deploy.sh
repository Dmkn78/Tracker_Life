#!/usr/bin/env bash
# Reproducible production deploy, run ON THE VPS (over SSH from the GitHub Actions
# workflow at .github/workflows/deploy.yml). One-time VPS setup this script assumes:
#   - repo checked out at REPO_DIR with an SSH remote backed by a GitHub deploy key,
#     so `git fetch` runs unattended against the private repo
#   - node/pnpm on PATH, and interface_API/.venv already created
#   - systemd units interface-api-backend and life-web installed and enabled
#   - passwordless sudo for restarting the configured API and web services
#
# Both apps load their own .env files (Next.js natively, FastAPI via load_dotenv in
# interface_API/app/config.py), so the systemd units need no EnvironmentFile.
#
# Usage: deploy.sh <git-sha-or-ref>
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/interface_API}"
TARGET_REF="${1:?Usage: deploy.sh <git-sha-or-ref>}"
LOCK_FILE="/tmp/life-regime-deploy.lock"
API_SERVICE="${API_SERVICE:-interface-api-backend}"
WEB_SERVICE="${WEB_SERVICE:-life-web}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deploy is already running (lock: $LOCK_FILE). Exiting."
  exit 1
fi

cd "$REPO_DIR"

# A dirty tree means someone edited production by hand. Deploying would silently
# discard that work, so stop and let a human decide.
if ! git diff --quiet HEAD; then
  echo "ERROR: $REPO_DIR has uncommitted changes to tracked files."
  echo "Inspect them with 'git -C $REPO_DIR status', then commit or discard before deploying."
  exit 1
fi

PREVIOUS_SHA="$(git rev-parse HEAD)"
echo "Current commit: $PREVIOUS_SHA"
echo "Deploying:      $TARGET_REF"

restart_services() {
  sudo systemctl restart "$API_SERVICE" "$WEB_SERVICE"
}

health_check() {
  sleep 3
  curl -fsS http://127.0.0.1:8000/api/health >/dev/null
  curl -fsS -o /dev/null http://127.0.0.1:3000
}

build_current_checkout() {
  pnpm install --frozen-lockfile
  pnpm prisma generate
  pnpm build
}

rollback() {
  trap - ERR
  echo "Deploy failed — rolling back code to $PREVIOUS_SHA."
  echo "NOTE: database migrations are NOT reverted automatically; check prisma/migrations manually if this deploy applied any."
  git checkout --quiet --force -B main "$PREVIOUS_SHA"
  build_current_checkout
  restart_services
  echo "Rollback complete. Previous commit ($PREVIOUS_SHA) is running again."
  exit 1
}
trap rollback ERR

git fetch --quiet origin
git checkout --quiet --force -B main "$TARGET_REF"

build_current_checkout
pnpm prisma migrate deploy

if ! git diff --quiet "$PREVIOUS_SHA" "$TARGET_REF" -- interface_API/requirements.txt; then
  echo "interface_API/requirements.txt changed, reinstalling."
  interface_API/.venv/bin/pip install -r interface_API/requirements.txt
fi

# The authenticated API starts a short-lived local Parakeet worker per recording.
python3 scripts/install-parakeet.py

# Restarting through systemd (rather than nohup) is what keeps the served HTML in
# sync with the freshly hashed .next/static assets: a surviving old process would
# still reference deleted chunk files, which is how the site once lost all its CSS.
restart_services

if ! health_check; then
  echo "Health check failed after deploying $TARGET_REF."
  rollback
fi

trap - ERR
echo "Deploy of $TARGET_REF succeeded and passed health checks."
