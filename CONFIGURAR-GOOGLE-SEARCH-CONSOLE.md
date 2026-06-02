# Configurar Google Search Console

Esta tarea se puede hacer despues. No cambia el diseño de la pagina ni afecta
Spotify, WhatsApp o las analiticas actuales.

## Para que sirve

Google Search Console permite:

- Confirmar que `lujourban.com` te pertenece.
- Informar a Google cuales paginas debe revisar.
- Consultar si la web aparece en Google.
- Ver busquedas, impresiones y clics recibidos desde Google.
- Detectar errores de indexacion.

El proyecto ya tiene listos estos archivos:

- `robots.txt`
- `sitemap.xml`

## Paso 1. Agregar el dominio

1. Entra a:

```text
https://search.google.com/search-console
```

2. Inicia sesion con tu cuenta de Google.
3. Pulsa **Anadir propiedad**.
4. Elige la opcion **Dominio**.
5. Escribe unicamente:

```text
lujourban.com
```

No escribas `https://`, `www` ni `/`.

## Paso 2. Verificar el dominio

Google mostrara un registro DNS parecido a este:

```text
google-site-verification=xxxxxxxxxxxx
```

1. Copia el codigo completo.
2. Entra al panel de la empresa donde compraste o administras el dominio.
3. Abre la configuracion DNS de `lujourban.com`.
4. Agrega un registro de tipo `TXT`.
5. En **Nombre**, **Host** o **Alias**, escribe `@` o deja el campo vacio si el
   proveedor lo permite.
6. En **Valor** o **Contenido**, pega el codigo entregado por Google.
7. Guarda el registro.
8. Regresa a Search Console y pulsa **Verificar**.

La propagacion DNS puede tardar. Si Google no lo reconoce inmediatamente,
espera y vuelve a intentar mas tarde sin borrar el registro.

## Paso 3. Enviar el sitemap

Despues de verificar la propiedad:

1. Abre **Sitemaps** en el menu izquierdo de Search Console.
2. En **Anadir un sitemap**, escribe:

```text
sitemap.xml
```

3. Pulsa **Enviar**.

El sitemap completo ya esta disponible en:

```text
https://www.lujourban.com/sitemap.xml
```

## Resultado esperado

Search Console mostrara el sitemap como enviado. Los datos de busquedas y
clics no aparecen inmediatamente; Google necesita tiempo para rastrear y
procesar la pagina.

