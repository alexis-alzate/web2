#!/usr/bin/env bash
set -euo pipefail

# Reactiva un lanzamiento guardado anteriormente para un artista.
cd "$(dirname "$0")/.."

read -r -p "Slug del artista (ej: siervo-john): " slug
node reactivate-artist-release.mjs "$slug"
