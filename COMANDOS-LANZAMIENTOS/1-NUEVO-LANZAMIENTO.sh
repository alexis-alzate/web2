#!/usr/bin/env bash
set -euo pipefail

# Agrega un lanzamiento nuevo y genera su enlace para compartir por WhatsApp.
cd "$(dirname "$0")/.."
node update-release.mjs
