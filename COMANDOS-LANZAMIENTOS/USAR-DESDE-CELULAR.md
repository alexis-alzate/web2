# Usar el asistente desde el celular

Puedes administrar los lanzamientos desde el navegador del celular usando
GitHub Codespaces. No necesitas instalar programas.

## 1. Abrir el repositorio

1. Abre Chrome en tu celular.
2. Entra a:

```text
https://github.com/alexis-alzate/web2
```

3. Inicia sesion en GitHub si es necesario.
4. Si la pagina se ve limitada, abre el menu de Chrome y activa
   **Sitio para computadores**.

## 2. Crear o abrir un Codespace

1. Dentro del repositorio pulsa el boton verde **Code**.
2. Abre la pestana **Codespaces**.
3. Pulsa **Create codespace on main**.
4. Espera mientras GitHub prepara el entorno.

Si ya existe un Codespace, pulsa su nombre para abrirlo.

## 3. Abrir la terminal

Cuando aparezca el editor web:

1. Abre el menu superior **Terminal**.
2. Pulsa **New Terminal**.
3. Ejecuta:

```bash
cd COMANDOS-LANZAMIENTOS
```

## 4. Agregar un lanzamiento nuevo

Ejecuta:

```bash
./1-NUEVO-LANZAMIENTO.sh
```

El asistente te pedira:

1. Enlace de Spotify.
2. Nombre de la cancion.
3. Nombre corto sugerido. Normalmente solo presiona `Enter`.
4. Featuring para WhatsApp. Dejalo vacio si no aplica.
5. Enlace para los botones. Usa `too.fm` si lo tienes o acepta Spotify.
6. Texto para WhatsApp.
7. Texto visible dentro de la pagina.
8. Version sugerida para evitar la cache de WhatsApp.

Al finalizar mostrara el enlace exacto que debes compartir.

## 5. Publicar

Ejecuta:

```bash
./3-PUBLICAR-CAMBIOS.sh
```

Espera unos minutos antes de compartir el enlace generado.

## 6. Volver a una cancion anterior

Ejecuta:

```bash
./2-REACTIVAR-ANTERIOR.sh
```

Escribe el numero de la cancion que quieres activar y luego publica:

```bash
./3-PUBLICAR-CAMBIOS.sh
```

## 7. Cerrar Codespaces

Cuando termines, puedes cerrar la pestana del navegador. Para evitar consumir
horas innecesarias, tambien puedes detener el Codespace desde GitHub:

1. Regresa a la pestana **Codespaces** del repositorio.
2. Abre el menu de tres puntos del Codespace.
3. Pulsa **Stop codespace**.

## Mostrar u ocultar la Comunidad VIP

Desde la misma terminal ejecuta:

```bash
cd COMANDOS-LANZAMIENTOS
./4-ALTERNAR-COMUNIDAD-VIP.sh
```

Este comando funciona como un interruptor y publica el cambio automaticamente.
No necesitas ejecutar `./3-PUBLICAR-CAMBIOS.sh` despues.

## Resumen rapido

Nuevo lanzamiento:

```bash
cd COMANDOS-LANZAMIENTOS
./1-NUEVO-LANZAMIENTO.sh
./3-PUBLICAR-CAMBIOS.sh
```

Volver a una cancion anterior:

```bash
cd COMANDOS-LANZAMIENTOS
./2-REACTIVAR-ANTERIOR.sh
./3-PUBLICAR-CAMBIOS.sh
```

Mostrar u ocultar la Comunidad VIP:

```bash
cd COMANDOS-LANZAMIENTOS
./4-ALTERNAR-COMUNIDAD-VIP.sh
```
