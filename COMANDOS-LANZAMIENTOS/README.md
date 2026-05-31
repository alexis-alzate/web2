# Comandos para lanzamientos

Abre una terminal dentro de esta carpeta:

```bash
cd /home/zaeta/Proyectos/web/zaetta-landing/COMANDOS-LANZAMIENTOS
```

## 1. Agregar un lanzamiento nuevo

Ejecuta:

```bash
./1-NUEVO-LANZAMIENTO.sh
```

Este asistente:

- Pide el enlace de Spotify.
- Descarga la portada.
- Actualiza la cancion visible y todos los botones.
- Permite agregar featuring solamente para la vista previa de WhatsApp.
- Genera el enlace exacto que debes compartir.
- Guarda la cancion en el historial.

## 2. Reactivar una cancion anterior

Ejecuta:

```bash
./2-REACTIVAR-ANTERIOR.sh
```

Muestra las canciones guardadas. Escribe el numero de la que quieres volver a
mostrar en la pagina.

## 3. Publicar los cambios

Despues de agregar o reactivar una cancion, ejecuta:

```bash
./3-PUBLICAR-CAMBIOS.sh
```

Esto ejecuta automaticamente `git add`, `git commit` y `git push`.

## Orden normal

Para un estreno nuevo:

```bash
./1-NUEVO-LANZAMIENTO.sh
./3-PUBLICAR-CAMBIOS.sh
```

Para volver a una cancion anterior:

```bash
./2-REACTIVAR-ANTERIOR.sh
./3-PUBLICAR-CAMBIOS.sh
```
