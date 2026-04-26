#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/skills/opencli-travel-hotel-matrix"
DEST_DIR="${HOME}/.codex/skills/opencli-travel-hotel-matrix"

mkdir -p "${HOME}/.codex/skills"
rm -rf "${DEST_DIR}"
cp -R "${SRC_DIR}" "${DEST_DIR}"

echo "Installed Codex skill to ${DEST_DIR}"
echo "Restart Codex to pick up the updated skill."
