#!/usr/bin/env bash
set -euo pipefail

# Agrega un lanzamiento al historial de un artista y lo deja activo.
cd "$(dirname "$0")/.."

read -r -p "Slug del artista (ej: siervo-john): " slug
node add-artist-release.mjs "$slug"
