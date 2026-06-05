#!/usr/bin/env bash
set -euo pipefail

if [[ -z "$(git status --porcelain)" ]]; then
  ahead_count="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
  if [[ "$ahead_count" -gt 0 ]]; then
    echo "No hay cambios nuevos, pero hay $ahead_count commit(s) pendiente(s) por subir."
    git push origin main
    echo
    echo "Publicacion enviada. Espera el despliegue antes de compartir el enlace."
    exit 0
  fi

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
