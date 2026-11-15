# Respaldo de la base de datos

Un solo comando, desde la raiz del repo:

```bash
node supabase/respaldo.mjs
```

Necesita Node 18 o superior y las llaves de Supabase. Las lee del entorno
(`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) o de `admin/.env.local`.
Es de solo lectura: no cambia nada en Supabase.

## Que hace

- Baja las 18 tablas de `public` a `respaldos/AAAA-MM-DD_HHMM/<tabla>.json`.
- Comprueba que la cantidad de filas bajadas coincida con la que informa la base. Si no coincide, falla en vez de dar un respaldo a medias.
- Guarda la **lista** de archivos de cada bucket (`storage_<bucket>.json`) y un `resumen.json`.
- Termina con codigo 2 y avisa si algo fallo: ese respaldo esta incompleto.

## Que NO hace

- **No copia los archivos de los buckets.** Los beats finales viven en el bucket privado `beats-files`: son lo mas valioso y hay que copiarlos aparte (por ejemplo con el panel de Supabase o con la CLI) hasta que haya una copia automatica.
- No restaura. Los JSON sirven para recuperar datos puntuales o reconstruir tablas con un script.

## Cuidado

Los respaldos traen correos de compradores y tokens de descarga. La carpeta
`respaldos/` esta en `.gitignore`: nunca la subas a GitHub ni la compartas.
Guardala fuera de este computador (nube privada o disco externo).

## Cada cuanto

Antes de cada migracion, antes de cada prueba grande y, como minimo, una vez por semana mientras no haya copia automatica. Supabase gratis **no** incluye respaldos diarios descargables: este script es tu red de seguridad.
