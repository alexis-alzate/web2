#!/usr/bin/env bash
set -euo pipefail

# Muestra u oculta la tarjeta VIP y publica el cambio inmediatamente.
cd "$(dirname "$0")/.."
node toggle-vip-community.mjs
git add script.js

if grep -q 'showVipCommunity: true' script.js; then
  message="Show VIP community card"
else
  message="Hide VIP community card"
fi

git commit -m "$message"
git push origin main

echo
echo "Cambio publicado. Espera unos minutos para verlo en la pagina."
