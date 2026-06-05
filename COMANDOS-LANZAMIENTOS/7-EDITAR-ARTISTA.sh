#!/usr/bin/env bash
set -euo pipefail

# Edita un solo campo de un artista y reconstruye la plantilla.
cd "$(dirname "$0")/.."

echo "Campos comunes:"
echo "  name"
echo "  cardName"
echo "  role"
echo "  tagline"
echo "  bio"
echo "  photo"
echo "  links.spotify"
echo "  links.tiktok"
echo "  links.instagram"
echo "  release.title"
echo "  release.link"
echo "  release.cover"
echo "  contact.url"
echo

read -r -p "Slug del artista (ej: siervo-john): " slug
read -r -p "Campo a editar: " campo
read -r -p "Nuevo valor (escribe --clear para borrar): " valor

node edit-artist.mjs "$slug" "$campo" "$valor"
