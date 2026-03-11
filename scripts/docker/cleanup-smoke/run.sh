#!/usr/bin/env bash
set -euo pipefail

cd /repo

export SUPPORTSQUADAI_STATE_DIR="/tmp/supportsquadai-test"
export SUPPORTSQUADAI_CONFIG_PATH="${SUPPORTSQUADAI_STATE_DIR}/supportsquadai.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${SUPPORTSQUADAI_STATE_DIR}/credentials"
mkdir -p "${SUPPORTSQUADAI_STATE_DIR}/agents/main/sessions"
echo '{}' >"${SUPPORTSQUADAI_CONFIG_PATH}"
echo 'creds' >"${SUPPORTSQUADAI_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${SUPPORTSQUADAI_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm supportsquadai reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${SUPPORTSQUADAI_CONFIG_PATH}"
test ! -d "${SUPPORTSQUADAI_STATE_DIR}/credentials"
test ! -d "${SUPPORTSQUADAI_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${SUPPORTSQUADAI_STATE_DIR}/credentials"
echo '{}' >"${SUPPORTSQUADAI_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm supportsquadai uninstall --state --yes --non-interactive

test ! -d "${SUPPORTSQUADAI_STATE_DIR}"

echo "OK"
