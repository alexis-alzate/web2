#!/usr/bin/env bash
set -euo pipefail

# Permite volver a mostrar una cancion guardada anteriormente.
cd "$(dirname "$0")/.."
node reactivar-lanzamiento.mjs
