# Comandos del sitio

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

## 4. Mostrar u ocultar la Comunidad VIP

Ejecuta:

```bash
./4-ALTERNAR-COMUNIDAD-VIP.sh
```

Este comando funciona como un interruptor: si la tarjeta VIP esta visible, la
oculta; si esta oculta, la vuelve a mostrar. Tambien publica el cambio
automaticamente, por lo que no necesitas ejecutar el comando 3 despues.

## 5. Agregar o actualizar un artista

Ejecuta:

```bash
./5-NUEVO-ARTISTA.sh
```

Este asistente crea la pagina del artista con la plantilla Lujo Urban y te
pregunta que secciones quieres incluir.

Puedes dejar vacio lo que no aplique:

- Foto principal.
- Spotify.
- TikTok.
- Instagram.
- YouTube.
- WhatsApp.
- Ultimo lanzamiento.
- Beats.
- Producciones.
- Contacto o booking.

Tambien actualiza automaticamente:

- `/artistas/`
- `/artistas/nombre-del-artista/`
- `sitemap.xml`

Despues publica con:

```bash
./3-PUBLICAR-CAMBIOS.sh
```

## 6. Mover un artista en el roster

Ejecuta:

```bash
./6-MOVER-ARTISTA.sh
```

Este asistente te pide:

- El slug del artista, por ejemplo `siervo-john`.
- El movimiento: `arriba`, `abajo` o una posicion numerica como `1`.

Tambien puedes usar el comando directo desde la raiz del proyecto:

```bash
node move-artist.mjs siervo-john arriba
node move-artist.mjs siervo-john abajo
node move-artist.mjs siervo-john 1
```

El comando actualiza automaticamente:

- `artist-data.json`
- `/artistas/`
- Las paginas individuales de artistas.
- `sitemap.xml`

El generador respeta este orden manual. Si luego creas o actualizas otro
artista, el roster mantiene el orden guardado en `artist-data.json`.

Despues publica con:

```bash
./3-PUBLICAR-CAMBIOS.sh
```
