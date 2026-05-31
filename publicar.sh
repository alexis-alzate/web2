#!/usr/bin/env bash
set -euo pipefail

if [[ -z "$(git status --porcelain)" ]]; then
  echo "No hay cambios pendientes para publicar."
  exit 0
fi

title="$(sed -nE 's/^  title: ["'\"'](.*)["'\"'],?$/\1/p' script.js | head -n 1)"
if [[ -z "$title" ]]; then
  title="lanzamiento"
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "Publicaria los cambios con el mensaje:"
  echo "Set ${title} as latest release"
  exit 0
fi

git add .
git commit -m "Set ${title} as latest release"
git push origin main

echo
echo "Publicacion enviada. Espera el despliegue antes de compartir el enlace."
