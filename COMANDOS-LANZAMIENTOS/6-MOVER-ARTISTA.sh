#!/usr/bin/env bash
set -euo pipefail

# Mueve una tarjeta de artista dentro del roster.
cd "$(dirname "$0")/.."

read -r -p "Slug del artista (ej: siervo-john): " slug
read -r -p "Movimiento (arriba, abajo o posicion numerica): " movimiento

node move-artist.mjs "$slug" "$movimiento"
