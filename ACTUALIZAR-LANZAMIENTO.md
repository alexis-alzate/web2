# Actualizar el lanzamiento

Desde una terminal ejecuta:

```bash
cd /home/zaeta/Proyectos/web/zaetta-landing
node update-release.mjs
```

El asistente te pedira:

1. El enlace de Spotify.
2. El nombre de la cancion.
3. Un nombre corto sin espacios ni tildes.
4. El enlace que abriran los botones. Usa `too.fm` si lo tienes.
5. El texto para WhatsApp.
6. El texto visible dentro de la web.
7. Una version. Para una cancion nueva usa `1`.

El asistente descarga la portada desde Spotify y actualiza la web, los botones,
los eventos de medicion y la vista previa social.

Al final mostrara el enlace exacto que debes compartir por WhatsApp.

## Publicar

Ejecuta:

```bash
git add .
git commit -m "Set nombre de la cancion as latest release"
git push origin main
```

Espera el despliegue antes de compartir el enlace.

## Corregir una vista previa

Si WhatsApp conserva una vista previa antigua, ejecuta nuevamente el asistente
con los mismos datos y aumenta la version a `2`, `3`, etc.
