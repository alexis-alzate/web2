# Comandos del sitio

## Panel principal

Desde la raiz del proyecto ejecuta:

```bash
./panel.sh
```

Tambien tienes un panel web local para administrar visualmente artistas y
lanzamientos:

```bash
node admin-panel.mjs
```

Luego abre:

```text
http://127.0.0.1:4177
```

Este panel web es privado/local. No usa React ni Next; trabaja encima de los
JSON y scripts actuales.

Si quieres abrirlo desde el celular, manten el computador y el celular en la
misma red WiFi. Al iniciar el panel se imprimen URLs tipo:

```text
Celular en la misma red: http://192.168.x.x:4177
```

Abre esa URL en el navegador del celular mientras el comando siga corriendo.

Para acceso ocasional fuera de la red local, usa el panel con PIN:

```bash
ADMIN_PIN=tu-clave-secreta node admin-panel.mjs
```

Luego puedes exponerlo temporalmente con una herramienta de tunel como
Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:4177
```

Abres la URL temporal en el celular y escribes el PIN. Cierra el comando cuando
termines de editar.

El panel muestra un menu para:

- Agregar o reactivar lanzamientos.
- Crear un nuevo lanzamiento principal de Zaetta.
- Reactivar el lanzamiento principal de Zaetta.
- Crear, editar, mover o borrar artistas.
- Agregar o reactivar lanzamientos de artistas.
- Mostrar u ocultar la Comunidad VIP.
- Publicar cambios.
- Revisar el estado de Git.

Si usas el panel no necesitas memorizar los comandos de abajo. Los comandos
individuales siguen disponibles por si quieres ir directo a una accion.

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

## 8. Agregar lanzamiento a un artista

Ejecuta:

```bash
./8-LANZAMIENTO-ARTISTA.sh
```

Este asistente pide:

- Slug del artista.
- Nombre del lanzamiento.
- Link del lanzamiento.
- Nombre corto.
- Ruta de portada opcional.

El lanzamiento queda activo en el perfil del artista y tambien queda guardado en
`artist-release-history.json`.

Tambien puedes usar el comando directo desde la raiz:

```bash
node add-artist-release.mjs siervo-john
```

## 9. Reactivar lanzamiento de un artista

Ejecuta:

```bash
./9-REACTIVAR-LANZAMIENTO-ARTISTA.sh
```

Este asistente muestra los lanzamientos guardados de ese artista y te deja
activar uno anterior.

Tambien puedes usar el comando directo desde la raiz:

```bash
node reactivate-artist-release.mjs siervo-john
```

Este historial es independiente del historial del lanzamiento principal del
home. El home de Zaetta usa `release-history.json`; los artistas usan
`artist-release-history.json`.

Despues publica con:

```bash
./3-PUBLICAR-CAMBIOS.sh
```

## 7. Editar un solo dato de un artista

Ejecuta:

```bash
./7-EDITAR-ARTISTA.sh
```

Este asistente cambia un solo campo del artista sin volver a llenar todo el
formulario.

Campos comunes:

- `name`
- `cardName`
- `role`
- `tagline`
- `bio`
- `photo`
- `links.spotify`
- `links.tiktok`
- `links.instagram`
- `release.title`
- `release.link`
- `release.cover`
- `contact.url`

Tambien puedes usar el comando directo desde la raiz del proyecto:

```bash
node edit-artist.mjs siervo-john cardName "El Siervo Jhon"
node edit-artist.mjs siervo-john tagline "Identidad cristiana con vision urbana."
node edit-artist.mjs siervo-john links.instagram "https://instagram.com/usuario"
node edit-artist.mjs siervo-john photo "/ruta/foto.jpg"
node edit-artist.mjs siervo-john links.spotify --clear
```

Cuando editas `photo` o `release.cover`, el comando copia la imagen a `assets/`
con el nombre correcto. Despues reconstruye automaticamente:

- `artist-data.json`
- `/artistas/`
- La pagina individual del artista.
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
