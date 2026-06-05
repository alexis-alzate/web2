#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

run_option() {
  case "$1" in
    1) ./COMANDOS-LANZAMIENTOS/1-NUEVO-LANZAMIENTO.sh ;;
    2) ./COMANDOS-LANZAMIENTOS/2-REACTIVAR-ANTERIOR.sh ;;
    3) ./COMANDOS-LANZAMIENTOS/5-NUEVO-ARTISTA.sh ;;
    4) ./COMANDOS-LANZAMIENTOS/7-EDITAR-ARTISTA.sh ;;
    5) ./COMANDOS-LANZAMIENTOS/6-MOVER-ARTISTA.sh ;;
    6)
      read -r -p "Slug del artista a borrar: " slug
      node delete-artist.mjs "$slug"
      ;;
    7) ./COMANDOS-LANZAMIENTOS/8-LANZAMIENTO-ARTISTA.sh ;;
    8) ./COMANDOS-LANZAMIENTOS/9-REACTIVAR-LANZAMIENTO-ARTISTA.sh ;;
    9) ./COMANDOS-LANZAMIENTOS/4-ALTERNAR-COMUNIDAD-VIP.sh ;;
    10) ./COMANDOS-LANZAMIENTOS/3-PUBLICAR-CAMBIOS.sh ;;
    11) git status --short --branch ;;
    0) exit 0 ;;
    *) echo "Opcion invalida." ;;
  esac
}

while true; do
  clear
  echo "LUJO URBAN - PANEL"
  echo
  echo "Lanzamientos"
  echo "  1. Nuevo lanzamiento"
  echo "  2. Reactivar lanzamiento anterior"
  echo
  echo "Artistas"
  echo "  3. Crear o actualizar artista"
  echo "  4. Editar un dato de artista"
  echo "  5. Mover artista en roster"
  echo "  6. Borrar artista"
  echo "  7. Agregar lanzamiento a artista"
  echo "  8. Reactivar lanzamiento de artista"
  echo
  echo "Sitio"
  echo "  9. Mostrar/ocultar Comunidad VIP (publica automatico)"
  echo "  10. Publicar cambios"
  echo "  11. Ver estado de Git"
  echo
  echo "  0. Salir"
  echo
  read -r -p "Elige una opcion: " option
  echo
  run_option "$option"
  echo
  read -r -p "Presiona Enter para volver al panel..." _
done
