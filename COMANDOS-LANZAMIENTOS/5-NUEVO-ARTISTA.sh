#!/usr/bin/env bash
set -euo pipefail

# Crea o actualiza una pagina de artista con la plantilla Lujo Urban.
cd "$(dirname "$0")/.."
node generate-artist.mjs
