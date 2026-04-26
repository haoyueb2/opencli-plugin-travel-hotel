#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${HOME}/.opencli/sites/trip/verify"

mkdir -p "${TARGET_DIR}"
cp "${ROOT_DIR}/verify/hotel-night-price.json" "${TARGET_DIR}/hotel-night-price.json"

echo "Installed verify fixture to ${TARGET_DIR}/hotel-night-price.json"
