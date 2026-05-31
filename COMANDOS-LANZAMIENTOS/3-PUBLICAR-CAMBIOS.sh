#!/usr/bin/env bash
set -euo pipefail

# Publica los cambios pendientes: git add, git commit y git push.
cd "$(dirname "$0")/.."
./publicar.sh
