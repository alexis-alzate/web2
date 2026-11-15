# AGENTS.md — LUJO URBAN

Documento de referencia completo para agentes de IA (Codex, Claude Code, etc.)
que trabajen en este repositorio. Si eres Claude Code, este archivo es tu
fuente de verdad (CLAUDE.md solo apunta aquí).

## 1. Descripción general del proyecto

**LUJO URBAN** es el ecosistema web del proyecto musical de Zaetta. Identidad
visual: premium, urbana, paleta negra/dorada. El repositorio (`web2`) contiene
varios sitios independientes desplegados por separado en Vercel/GitHub Pages
a partir de carpetas distintas de un mismo monorepo:

- **Sitio principal** (raíz del repo) — sitio estático (HTML/CSS/JS) en
  `www.lujourban.com`, con páginas de artistas, lanzamientos, servicios, etc.
- **`tienda/`** — tienda de beats (Next.js), en `tienda.lujourban.com`.
  Catálogo, carrito, checkout con MercadoPago, descargas digitales.
- **`admin/`** — panel privado de administración (Next.js), en
  `admin.lujourban.com` (o `panel.lujourban.com`). Gestiona contenido del
  sitio estático (vía GitHub API), beats de la tienda, y órdenes de venta.
- **`lujourban-vision/`** — micrositio del sello (`casa.lujourban.com`).
- **`supabase/migrations/`** — esquema SQL de la base de datos compartida por
  `tienda` y `admin`.

## 2. Estructura real del repositorio

```
web2/
├── index.html, styles.css, script.js, ...   # sitio estático principal
├── vercel.json                               # reglas de enlaces cortos (lo genera el panel)
├── artistas/, lanzamientos/, servicios/, estados/  # contenido del sitio estático
├── unete/                                    # formulario público de lista de espera (www.lujourban.com/unete/)
├── vender/                                   # solicitud de cuenta de productor (www.lujourban.com/vender/)
├── lujourban-vision/                         # micrositio casa.lujourban.com
├── *.mjs, panel.sh, publicar.sh              # scripts de gestión de contenido estático
├── supabase/
│   └── migrations/                           # 001..025, SQL incremental, se corre a mano en Supabase SQL Editor
├── tienda/                                    # Next.js — tienda de beats (pública)
│   ├── app/
│   │   ├── page.tsx                          # catálogo (server component)
│   │   ├── [slug]/page.tsx                   # detalle de beat + SEO
│   │   ├── productor/[slug]/page.tsx         # tienda pública de un productor (tienda.lujourban.com/productor/<slug>)
│   │   ├── descarga/page.tsx                 # post-compra: descargas + estado de la orden
│   │   ├── descarga/AutoRefresh.tsx          # auto-refresh mientras el pago está pending
│   │   ├── api/checkout/route.ts             # crea order + order_items + preferencia MercadoPago
│   │   ├── api/mp-webhook/route.ts           # webhook de MercadoPago
│   │   ├── api/download/[token]/route.ts     # entrega de archivos via signed URL
│   │   ├── components/                       # BeatCatalog, BeatRow, BeatDetail, CartDrawer, Header, PlayerBar, Hero, Icons
│   │   └── providers/                        # CartProvider (localStorage), PlayerProvider
│   ├── lib/
│   │   ├── types.ts                          # Beat, LicenseType, LICENSE_LABELS, helpers de precio/archivo
│   │   ├── orders.ts                         # approveOrder() — idempotencia, exclusivas, email
│   │   ├── email.ts                          # sendDownloadEmail() via Resend SDK
│   │   ├── producers.ts                      # getProducerBySlug() / getProducerSlugs() / withProducerSlugs(): lectura pública mínima (id, slug, nombre) de productores activos
│   │   ├── format.ts                         # formatCOP, formatTime, publicUrl
│   │   └── supabase/server.ts                # clientes anon (catálogo) y service-role (route handlers)
│   └── .env.example
└── admin/                                     # Next.js — panel privado
    ├── app/
    │   ├── page.tsx                          # dashboard principal (todas las secciones)
    │   ├── actions-beats.ts                  # CRUD de beats, upload a Storage, toggle demo beats
    │   ├── actions-orders.ts                 # listar órdenes, reenviar correo de descarga
    │   ├── actions.ts                        # acciones de contenido del sitio estático (GitHub)
    │   ├── actions-waitlist.ts               # cambiar el estado de una solicitud de la lista de espera
    │   ├── api/waitlist/route.ts             # endpoint PÚBLICO: recibe el formulario de /unete/
    │   ├── api/producer-applications/route.ts # endpoint PÚBLICO: recibe el formulario de /vender/
    │   ├── actions-producer-applications.ts  # aprobar / rechazar solicitudes de productor (safeAction)
    │   ├── auth-actions.ts, auth/, login/, forgot-password/, reset-password/
    │   ├── productor/                        # portal del PRODUCTOR (/productor): layout, producer-data.ts (loadProducer), productor.css
    │   ├── producer-access-actions.ts        # invitar / pausar / desvincular el acceso de un productor (safeAction)
    │   ├── producer-payout-actions.ts        # el productor dice cómo cobra; el admin registra un pago (safeAction)
    │   ├── api/                              # endpoints internos del panel
    │   └── components/                       # ActionForm, SubmitButton, AnalyticsDashboard, etc.
    └── lib/
        ├── beats.ts                          # tipos Beat/LicenseType, slugify, beatCoverUrl, LICENSE_LABELS
        ├── email.ts                          # sendDownloadEmail() via fetch a Resend API (sin SDK)
        ├── auth.ts, admin-session.ts         # auth del panel (Supabase Auth)
        ├── github.ts, artist-renderer.ts     # edición del sitio estático vía API de GitHub (commitFiles: borra y reintenta)
        ├── errors.ts                         # errores con tipo (Validation 400, Unauthorized 401, Forbidden 403, NotFound 404, Conflict 409, Publish 502)
        ├── actions/safe-action.ts            # traductor central de errores de Server Actions ({ ok, code, message })
        ├── producer-applications/            # solicitudes de productor: rules.ts (puras) → service.ts → repository.ts; index.ts = composición
        ├── producers/                        # capa de productores: access-service.ts (reglas) → repository.ts + supabase-access-directory.ts + invite-email.ts; index.ts = composición
        ├── artists/                          # capa de artistas: index.ts (composicion) → service.ts (reglas) → repository.ts (BD) + site-publisher.ts (GitHub)
        ├── analytics.ts                      # métricas de lanzamientos
        ├── waitlist.ts                       # lista de espera: validación y normalización de solicitudes
        └── supabase/admin-client.ts          # cliente service-role
```

## 3. Tienda pública vs. Admin — diferencia clave

| | `tienda/` | `admin/` |
|---|---|---|
| Audiencia | Pública (clientes) | Privada (solo Zaetta/equipo) |
| Auth | Ninguna (compra como invitado) | Supabase Auth (login obligatorio) |
| Acceso a Supabase | Cliente anon (catálogo, solo lectura con RLS) + service-role (route handlers de checkout/webhook/descarga) | Siempre service-role (`admin/lib/supabase/admin-client.ts`) |
| Función | Catálogo, carrito, checkout, descargas | Gestión de beats, órdenes, contenido del sitio estático, analíticas |
| Variables de entorno | Propias en su proyecto Vercel | Propias en su proyecto Vercel — **NO se comparten automáticamente** con `tienda` aunque usen el mismo proyecto Supabase |

## 4. Stack

- **Next.js 14+ (App Router, TypeScript)** para `tienda/` y `admin/`, cada uno con su propio `package.json`, deploy y dominio en Vercel.
- **Supabase**: Postgres (tablas `beats`, `orders`, `order_items`, `downloads`, `app_settings`) + Storage (`beats-covers` público, `beats-previews` público, `beats-files` privado) + Auth (solo para `admin`).
- **MercadoPago Checkout Pro (Colombia)** para pagos.
- **Resend** para correos transaccionales, dominio verificado `lujourban.com`, remitente `pedidos@lujourban.com`.
- **Vercel** para deploy de `tienda` y `admin` (push a `main` = deploy automático). El sitio estático principal también se sirve desde el repo.
- **GitHub API** (token con permisos de lectura/escritura) usado por `admin` para editar el contenido del sitio estático sin tocar el repo localmente.

## 4.1 Artistas: Supabase es la fuente de verdad

Desde la migración 017 los artistas viven en tablas (`artists`, `artist_links`,
`artist_releases`, `artist_access`) con RLS activo y sin políticas: solo
`service_role` (el panel) puede leer o escribir.

Capas en `admin/` (no mezclarlas). Es la misma arquitectura que la API de Java
(`lujourban-api`): controller → service → repository + manejador de errores
central.

```
Server Action = controller   (app/actions.ts, artist-portal-actions.ts)
   lee el formulario, comprueba permisos, llama al servicio. Envuelta en safeAction.
   └─ ArtistService          (lib/artists/service.ts)
        reglas Y validaciones, orden de operaciones, qué publicar o borrar.
        Recibe por constructor (inyección de dependencias):
        ├─ ArtistRepository  → SupabaseArtistRepository (repository.ts): único que toca las tablas
        ├─ SitePublisher     → GithubSitePublisher (site-publisher.ts): sabe dónde viven las páginas
        └─ CoverFetcher      → fetchSmartLinkCover (images.ts)
   lib/artists/index.ts = raíz de composición: único lugar que elige las implementaciones
safeAction (lib/actions/safe-action.ts) = @RestControllerAdvice: atrapa los errores con tipo
   y devuelve { ok: false, code, message }; los inesperados se registran y se muestran genéricos.
```

- **Errores**: las capas lanzan errores con tipo de `lib/errors.ts`
  (`ValidationError`, `ConflictError`, `NotFoundError`, ...); nunca `new Error`
  para algo que el usuario deba leer. Solo `safeAction` decide cómo se muestran.
- **Server Actions nuevas**: envolverlas en `safeAction`. Se devuelve el error
  en vez de lanzarlo porque Next.js en producción oculta el texto de los
  errores lanzados desde una Server Action. `ActionForm` entiende ambas formas.
- **Pruebas**: gracias a la inyección, el servicio se prueba con dobles
  (repositorio y publicador falsos) sin Supabase ni GitHub. Ver
  `admin/tests/` y la sección 9.

- Las páginas `artistas/*/index.html`, `artistas/index.html`, `sitemap.xml`,
  `artist-data.json` y `artist-release-history.json` son una **proyección
  generada** desde la base en cada cambio. **No se editan a mano**: el
  siguiente guardado las sobrescribe.
- Guardar / mover / lanzamiento: primero la base, después GitHub (si GitHub
  falla, volver a guardar reintenta). Borrar: primero GitHub, después la base.
- Borrar un artista borra su página y las de compartir de sus lanzamientos
  (`commitFiles(..., { deletes })`) y, por cascada en la base, links,
  lanzamientos y `artist_access`. Las imágenes de `assets/` se conservan.
- `commitFiles` reintenta hasta 3 veces si otro commit entra a la rama al
  mismo tiempo (422 "not a fast forward").
- Subidas de imagen: solo JPG/PNG/WebP de hasta 5 MB (`lib/artists/images.ts`).
- Enlace de invitación y de recuperación en **dos pasos**: el correo lleva a
  `/auth/confirm` (página con un botón, **no valida nada**) y la validación con
  Supabase (`verifyOtp`) ocurre al tocar el botón, en `POST /api/auth/confirm`.
  Es a propósito: Gmail, Outlook, antivirus y las vistas previas de WhatsApp
  abren los enlaces solos, y como el enlace sirve una sola vez, un GET que
  validara lo gastaría antes que la persona (llegaba a `/login` y tenía que usar
  "Olvidé mi clave"). Reglas puras en `lib/auth-confirm.ts` (tipos permitidos,
  destino interno, textos). No volver a validar en un GET. Si el enlace ya se
  usó o venció, `/login?error=invite` lo explica. El vencimiento lo fija
  Supabase (Authentication → "Email OTP expiration", máx. 24 h).
- Portal del artista (`/mi-perfil`): es lo que ve el cliente. Tiene cuatro
  pantallas con navegación fija (abajo en celular, arriba en computador):
  - **Inicio** (`/mi-perfil`): visitas del mes, su enlace para copiar, su
    código QR para descargar, la lista "Por hacer" (`lib/portal-todos.ts`:
    foto, portada, enlaces repetidos entre canciones, redes) y la canción
    principal.
  - **Mi música** (`/mi-perfil/musica`): canción principal, publicar música
    nueva y "Más música". Cada canción se puede **corregir** (nombre, enlace,
    portada), **volver principal** o **borrar** (la principal no se borra).
    Servicio: `updatePortalRelease`, `promotePortalRelease`,
    `deletePortalRelease`. El slug de la canción nunca cambia. Borrar sigue
    la regla de siempre: primero el sitio, después la base.
  - **Mi página** (`/mi-perfil/pagina`): foto y redes (enlaces, botones de
    arriba y orden).
  - **Estadísticas** (`/mi-perfil/estadisticas`): cifras, visitas por día
    (`DailyBars`), de dónde llegan (`SourceVinyl`, el disco), qué enlaces
    tocan y escuchas por canción.
  No puede tocar nombre, slug, bio ni embeds: eso sigue siendo del admin.
  - `app/mi-perfil/portal-data.ts` (`loadPortal`) hace la comprobación de
    acceso y la usan el layout **y** cada página: no confiar solo en el layout.
  - Cada formulario es pequeño y manda solo sus campos; la acción
    (`saveOwnArtistPortalAction`) completa lo que falta con el perfil actual,
    así guardar la foto no toca los enlaces.
  - Diseño: todo vive bajo `.pt` en `app/mi-perfil/portal.css`, con las
    fuentes de la página pública (Bebas Neue y Barlow, vía `@fontsource`).
    Reglas: texto en minúscula normal (sin etiquetas en mayúsculas ni
    numeración 01/02), el verde solo para datos y la acción principal, y
    medidas fijas: lo único que cambia de alto son los paneles "Editar".
  - Las vistas (`app/components/portal/*View.tsx`) reciben datos por props y
    no leen nada: así se pueden renderizar aparte para revisarlas.
  - La foto del portal se guarda como `assets/<slug>-photo-<huella>.<ext>`
    (huella del contenido) para que una foto nueva no quede tapada por caché;
    las portadas corregidas, igual (`…-cover-<huella>.<ext>`).
  - `PortalImageField` reduce las imágenes en el navegador (máx. 1400 px, JPG)
    antes de subirlas; el servidor igual valida tipo y peso.
  - La cuenta de prueba valida lo mismo pero no guarda imágenes ni puede
    editar canciones anteriores.
- Código QR del artista (tarjeta "Tu código QR" en Inicio,
  `components/portal/PortalQr.tsx`): lleva a su enlace público
  (`publicArtistUrl`: el corto si existe, si no la dirección larga). Capas:
  - `app/api/portal/qr/route.ts` = controlador delgado. `GET
    /api/portal/qr?formato=png|svg` (`&descargar=1` lo baja como archivo).
    El artista sale **siempre de la sesión** (`requireActiveArtist`), nunca de
    la petición; el proxy no cubre `/api/`, así que la sesión se comprueba en
    la ruta. La cuenta de prueba no tiene QR (no tiene página pública).
  - `lib/artist-qr.ts` = reglas puras: formato (`parseQrFormat`), destino
    permitido (`assertQrTarget`: solo `https` de `lujourban.com` y
    `www.lujourban.com`), nombre del archivo y `qrPath`.
  - `lib/qr/renderer.ts` = único que conoce la librería `qrcode` (puerto
    `QrRenderer`); `lib/qr/index.ts` es su raíz de composición. Dibuja negro
    sobre blanco, corrección de errores Q y margen de 4 módulos: no invertir
    colores ni quitar el margen, las cámaras dejan de leerlo. PNG de 1200 px.
  - Botón "Copiar QR" (como el QR de Instagram: se copia y se pega la imagen en
    WhatsApp, etc.): `components/portal/QrCopyButton.tsx` (cliente, solo el
    estado del botón) + `lib/clipboard-image.ts` (la lógica; recibe el
    navegador por parámetro y tiene pruebas). Entrega al portapapeles la
    **promesa** de la imagen, no la imagen, porque Safari exige crear el item
    dentro del toque del usuario. Necesita HTTPS y un navegador con
    `ClipboardItem`; si no, el botón lo avisa y quedan las descargas.
  - Errores de rutas API: `lib/route-error.ts` (`errorResponse`), el hermano de
    `safeAction` para Route Handlers.
  - Un QR impreso queda fijo: apunta a la dirección vigente al descargarlo. La
    dirección larga sigue sirviéndose aunque después se asigne enlace corto,
    pero si se cambia el slug o el enlace corto de un artista, sus QR ya
    impresos dejan de funcionar. Conviene asignar el enlace corto **antes** de
    que imprima.
  - Pendiente (opcional): contar escaneos añadiendo `?origen=qr` y leyéndolo en
    la página pública y en `release_events`.
- Estadísticas del artista en el portal (`lib/artist-stats.ts`): visitas, escuchas y compartidos de los últimos 30 días, las
  visitas por día y de dónde llegan. Salen de `release_events` filtrando por
  el `artist_slug` de la sesión (nunca del navegador). `summarizeArtistStats`
  es pura y tiene pruebas. La página pública registra como máximo una visita
  y una acción por navegador, lanzamiento y día, así que son "personas", no
  clics totales.
- Clics por enlace (migración 019, tabla `artist_link_clicks`): la página
  pública avisa a `admin/app/api/analytics/link-click/route.ts` cuando alguien
  toca Spotify, Instagram, etc. (botones de arriba o cuadrícula; atributos
  `data-artist-link`). Máximo un clic por navegador, enlace y día. Es un
  endpoint **público** con las mismas reglas que el de la lista de espera:
  Origin permitido, solo valores de listas cerradas (`lib/link-clicks.ts`),
  llave foránea a `artists(slug)`, sin mensajes internos de la base. No tiene
  tope por hora. Si la tabla no existe o la lectura falla, la tarjeta se
  muestra igual, sin ese bloque de datos.
- Enlace corto (migración 020, columna `artists.short_link`): el admin le
  pone a cada artista un nombre corto y `www.lujourban.com/<nombre>` muestra
  su página **sin cambiar la dirección** (rewrite de Vercel hacia
  `/artistas/<slug>/index.html`). Las reglas están en
  `lib/artists/short-link.ts` (formato, nombres reservados, que no choque con
  otro artista). El publicador regenera los rewrites en **`vercel.json` (raíz
  del repo)** en cada guardado, conservando cualquier otra configuración.
  Cuidados:
  - La página del artista se sirve en dos direcciones, así que sus estilos e
    imágenes usan rutas desde la raíz (`/styles.css`, `/assets/...`), nunca
    `../../`.
  - Un enlace corto no puede llamarse como una carpeta del sitio. Toda carpeta
    nueva de primer nivel debe agregarse a `RESERVED_SHORT_LINKS` (hay una
    prueba que falla si falta).
  - Un `vercel.json` inválido hace fallar el despliegue del sitio principal.
    No editarlo a mano sin validar; las reglas de enlaces cortos no se editan
    a mano (el siguiente guardado las reescribe).
  El artista ve su enlace con un botón de copiar en el portal (`PortalLink`),
  pero solo el admin puede cambiarlo. En el panel cada artista muestra su
  enlace con botón de copiar (`CopyTextButton`). `publicArtistUrl` decide la
  dirección que se muestra, se copia y abren los botones "Ver perfil": la
  corta si existe, si no la larga.
- "Más música" en la página pública: debajo de "Último lanzamiento" se
  listan los lanzamientos anteriores del artista (`renderMoreMusic` y
  `pastReleasesOf` en `artist-renderer.ts`), del más nuevo al más viejo, sin
  el actual y con un máximo de 8. Sale del historial (`artist_releases`), no
  hay nada que llenar; si no hay anteriores, la sección no se genera. Tocar
  una fila cuenta como escucha de ese lanzamiento. Los estilos
  (`.more-music*`) están en `styles.css` de la raíz, que es un archivo escrito
  a mano: es a propósito más discreta que el lanzamiento actual y sus filas
  tienen alto fijo.
- Pendiente: vincular usuarios por `artist_access` en lugar de
  `app_metadata.lujo_artist_slug` (hoy el slug en metadatos sigue siendo lo
  que usa `getCurrentAccess`; renombrar o borrar un artista deja ese slug
  desactualizado).

## 4.2 Lista de espera de artistas

- Cada página de artista y el directorio terminan con la invitación
  "Quiero mi página" (`renderArtistDiscovery` y `renderDirectory` en
  `admin/lib/artist-renderer.ts`), que lleva a `www.lujourban.com/unete/`.
- `unete/index.html` es una página estática escrita a mano (no la genera el
  panel). Su formulario hace `POST https://admin.lujourban.com/api/waitlist`.
- `admin/app/api/waitlist/route.ts` es el **único endpoint donde un visitante
  escribe en la base**. Protecciones: Origin permitido, validación estricta
  (`lib/waitlist.ts`), campo trampa `website`, tope de 40 solicitudes por hora
  y WhatsApp único. No devuelve mensajes internos de la base. Si se cambia,
  mantener todas esas protecciones.
- Tabla `artist_waitlist` (migración 018): RLS activo y sin políticas, solo
  `service_role`. Estados: `new`, `contacted`, `approved`, `rejected`.
- En el panel, sección "Lista de espera". Marcar "Aprobado" es solo una marca:
  la invitación se sigue enviando desde los accesos de artistas.
- Colores: dorado (`--join-gold`) = Lujo Urban, la plataforma; verde = el
  artista. Un solo botón dorado relleno por pantalla.

## 4.3 Productores: acceso y portal (`/productor`)

Un productor es una tercera clase de cuenta, al lado de admin y artista. Entra
con el mismo login y cae en **su** zona; nunca ve el panel ni el portal de
artistas.

- **Rol**: `app_metadata.lujo_role = 'producer'` + `lujo_producer_id` (el `id` de
  `producers`) + `lujo_access`. `readAccessMetadata` lo lee (`producerId`) y
  `requireActiveProducer()` es el guardia para código de productores.
  `lib/access-destination.ts` (`destinationFor`) decide a dónde manda el login a
  cada rol; es pura y tiene pruebas. `/` manda a los productores a `/productor`
  y `/mi-perfil` también.
- **Login común** (`admin/app/login/page.tsx`): artistas, productores y admin entran por la
  misma pantalla; el rol sale de la cuenta, no de la pantalla. No hacer logins separados
  (duplicaría recuperación de clave, invitaciones y errores sin ganar seguridad). Su acento
  es el **dorado** de Lujo Urban, acotado a `.login` en `globals.css`; el verde del panel
  no cambia. Nada debe cambiar de tamaño al enfocar o pasar el cursor.
- **Datos siempre de la sesión**: `loadProducer()` (`app/productor/producer-data.ts`)
  toma el productor de la sesión, nunca de la petición. Igual que en el portal
  del artista, la comprobación va ahí y no solo en el layout.
- **Capas** (no mezclarlas, mismo estilo que los artistas):
  ```
  Server Action = controller  (app/producer-access-actions.ts, safeAction, requireAdmin)
    └─ ProducerAccessService   (lib/producers/access-service.ts)  reglas: a quién invitar,
         │                      un correo = un solo tipo de acceso, un productor = una cuenta
         ├─ ProducerRepository → SupabaseProducerRepository (repository.ts)
         ├─ AccessDirectory    → SupabaseAccessDirectory (único que usa supabase.auth.admin)
         └─ InviteMailer       → ResendInviteMailer (invite-email.ts)
  lib/producers/index.ts = raíz de composición
  ```
  Pruebas con dobles en memoria: `tests/producer-helpers.ts`.
- **Invitar**: desde el panel, en la tarjeta del productor ("Productores") →
  "Invitar al portal". Usa el mismo enlace de dos pasos de la sección 4.1 (el
  correo lleva a `/auth/confirm`, no valida al abrirse). Un productor inactivo no
  se puede invitar. "Cambiar el correo" lo desvincula (si nunca creó su clave, la
  invitación se borra).
- **Portal** (`/productor`): ganancias (`lib/producers/earnings-summary.ts`, pura,
  mes en hora de Colombia), sus beats y sus últimas ventas. La vista
  (`components/producer/ProducerHomeView.tsx`) recibe todo por props.
  Diseño: reutiliza la base de `mi-perfil/portal.css` y agrega `productor.css`;
  el acento es el **dorado** de Lujo Urban (`#e3b873`), no el verde (que es del
  artista). Filas de alto fijo.
- **Los productores NO se registran en la bitácora de actividad** (`portal_sessions`
  solo admite `admin` y `artist`); el login lo omite.
- **Lo que todavía NO hace** (pendiente, por orden):
  1. Subir y editar beats desde el portal. **Bloqueado a propósito** hasta mover el
     almacenamiento de beats a Cloudflare R2: el plan gratis de Supabase limita cada
     archivo a 50 MB y 1 GB en total. No habilitar la subida del productor sobre
     Supabase Storage. Cuando se haga: rutas por productor (`productores/<id>/...`),
     que el productor solo toque lo suyo, y revisión del admin antes de publicar.
  2. Pago directo al productor (Split de Mercado Pago). Hoy es liquidación manual:
     el dinero entra a la cuenta de Lujo Urban, `producer_earnings` registra cuánto
     le corresponde y el admin le transfiere por fuera (Nequi, banco) y lo registra
     (ver "Liquidaciones a productores" abajo). Tocar el flujo de cobro exige auditar
     y explicar riesgos antes (sección 10).
  3. Página pública del productor con sus beats.

### Liquidaciones a productores (migración 025)

Lujo Urban cobra todo y le debe a cada productor su parte (`producer_earnings`,
estado `pending`). Esta app **no mueve dinero**: el admin transfiere por fuera
y aquí deja el registro.

- **Cómo cobra el productor**: en su portal, sección "Tu pago" (Nequi, Daviplata,
  Bancolombia u otro banco + nombre del titular). Se guarda en `producers`
  (`payout_method`, `payout_account`, `payout_holder`). Nequi y Daviplata se
  validan como celular colombiano (10 dígitos, empieza por 3). Es un dato
  **sensible**: `producers` sigue con RLS sin políticas y la tienda pública NO lo
  selecciona (`getProducerBySlug` pide solo columnas concretas; no ampliarlo).
- **Dias de espera y pago minimo**: cada venta se **libera 7 dias despues** de la compra
  (`producer_earnings.available_at`, valor por defecto de la columna: la funcion que
  aprueba ordenes NO cambia) para cubrir devoluciones. El panel solo deja pagar lo
  **liberado** y exige un total de al menos **$50.000** (`HOLD_DAYS` y
  `MIN_PAYOUT_AMOUNT` en `payout-rules.ts`; si cambia `HOLD_DAYS`, cambia tambien el
  `interval '7 days'` de la migracion 025). La funcion SQL lo vuelve a comprobar:
  si lo liberado no llega al minimo, no paga nada.
- **Transparencia para el productor**: al venderse un beat le llega un correo con lo que
  va a recibir y la fecha en que se libera (`tienda/lib/email.ts`); en `/productor` ve
  Disponible / En espera / Ya pagado y, en cada venta, "En espera · se libera el X";
  y al registrarse un pago le llega otro correo con monto, ultimos 4 digitos de la
  cuenta y referencia (`payout-email.ts`). Si ese correo falla, el pago NO se deshace:
  el panel avisa para que se lo comuniques tu.
- **Pagar** (panel, tarjeta del productor → `ProducerPayoutControl`): muestra lo
  liberado ("Para pagar hoy"), lo que sigue en espera y la cuenta; el admin transfiere,
  escribe la referencia (comprobante), marca "Ya transferí $X a esa cuenta" y
  registra. Un solo clic paga **todo lo liberado** del productor.
- **Atomicidad**: la función SQL `register_producer_payout` bloquea al productor,
  marca las ventas pendientes como pagadas y crea el pago en una sola transacción;
  el monto del pago es exactamente la suma de lo marcado. Dos clics (o dos
  pestañas) no pagan dos veces. Si el productor cambia su cuenta mientras el admin
  mira la pantalla, la función se niega (`p_expected_account`). Los mensajes que
  empiezan con `LU:` se muestran tal cual al admin. Permisos: solo `service_role`.
- **Libro de pagos**: `producer_payouts` (monto, cantidad de ventas, copia de la
  cuenta usada, referencia, quién lo registró, cuándo). `producer_earnings.payout_id`
  enlaza cada venta con su pago; las pagadas antes de la 025 quedan sin enlace.
- **Capas**: `producer-payout-actions.ts` (controladores; productor y admin salen de
  la sesión) → `lib/producers/payout-service.ts` → `repository.ts` + RPC;
  `payout-rules.ts` tiene las reglas puras. Pruebas: `tests/producer-payout.test.ts`.
  La función SQL se probó contra un Postgres real (suma, doble clic, 4 clics
  simultáneos, rollback, cuenta cambiada, permisos); no hay forma de probarla con
  dobles en memoria, así que si se cambia hay que volver a probarla en Postgres.
- **Orden de despliegue**: correr la migración 025 **antes** de desplegar el
  código; el portal, el panel **y el correo de venta de la tienda** leen las columnas
  nuevas (si falta `available_at`, el correo al productor no sale, aunque el pago del
  comprador se aprueba igual).
- **Medios de pago del comprador**: Checkout Pro Colombia ofrece tarjetas, cuenta
  Mercado Pago, PSE y Efecty; Nequi y Daviplata se pagan **a través de PSE**. No
  hay nada que configurar en el código para recibirlos.
- Pendiente: reembolsos (un reembolso después de pagarle al productor deja la venta
  pagada; hoy se resuelve a mano), exportar el libro, y cuando haya muchos productores
  **automatizar la transferencia** (pagos a terceros de Wompi/ePayco; la auditoría del
  Split de Mercado Pago quedó en `AUDITORIA-SPLIT-MERCADOPAGO.md`, con un posible
  bloqueante sin confirmar sobre PSE/Nequi).

### Tienda pública del productor

Cada productor tiene **su propia tienda** en
`tienda.lujourban.com/productor/<slug>`, desde el momento en que existe, tenga
beats o no (sin beats muestra "Los primeros beats están por llegar").

- **Slug** (migración 022, `producers.slug`, único, `NOT NULL`, formato
  `^[a-z0-9]+(-[a-z0-9]+)*$`): lo pone un **trigger** de la base al insertar
  (`producers_set_slug`), a partir del nombre artístico (`producer_slug_base`:
  sin tildes, guiones; si ya existe, `-2`, `-3`...). Así lo tienen los dos
  caminos de creación (formulario del panel y aprobación de solicitudes) sin
  repetir la regla en código. El slug **no cambia** si después se edita el
  nombre: es la dirección que el productor comparte.
- **Diseño de la página**: cabecera con portada, avatar con iniciales, nombre, cantidad de beats,
  sello "Aprobado por Lujo Urban" y botón de compartir (`components/producer-store/`:
  `ProducerStoreHero`, `ShareStoreButton`, `ProducerStoreEmpty`; reciben todo por props). Con
  beats sigue el `BeatCatalog`; sin beats muestra "Los primeros beats llegan pronto" y las
  licencias (`LICENSE_LABELS`). **No enlaza al catálogo general**: la tienda es del productor.
  Sin foto, el avatar es un círculo **lleno** de 72 px con la inicial: toma uno de 5 tonos de la
  paleta según el slug (`lib/avatar.ts`, determinista, `data-tone` en CSS), así cada tienda se
  distingue sin guardar nada. Cuando haya foto del productor, reemplaza este círculo.
  Oculta el banner genérico de Lujo Urban con `body:has(.pstore-page)`. Márgenes laterales
  iguales a los del catálogo (12 px en celular).
- **Página** (`tienda/app/productor/[slug]/page.tsx`): lee la ficha con
  `getProducerBySlug` (`tienda/lib/producers.ts`) y los beats con el cliente
  anónimo filtrando por `producer_id`. `producers` tiene RLS sin políticas
  (guarda correo y comisión), por eso ese helper usa el cliente de servicio
  pero pide **solo** `id, slug, stage_name` y solo productores `active`. No
  ampliar ese `select`: lo que se agregue se vuelve público.
- **Dónde se ve el enlace** (`admin/lib/producers/store-url.ts`, puro):
  correo de invitación (bloque "Tu tienda"), tarjeta "Tu tienda" en `/productor`
  (abrir y copiar; cada beat de su lista enlaza a su página pública) y la tarjeta
  del productor en el panel (con botón de copiar). El origen sale de `TIENDA_URL`
  (por defecto `https://tienda.lujourban.com`).
- **Orden de despliegue**: correr la migración 022 **antes** de desplegar el
  código; el portal lee la columna `slug` y falla si no existe.
- La comisión por defecto al crear un productor (formulario del panel) es 15 %
  (`DEFAULT_COMMISSION_PERCENT`), igual que al aprobar una solicitud.
- **"Prod. by X" enlaza a la tienda**: `BeatDetail` y `FeaturedBeat` pintan el nombre con
  `ProducerName` (`tienda/app/components/ProducerName.tsx`): enlace a
  `/productor/<slug>` si el productor tiene tienda, texto plano si no (beat con
  `producer_id` nulo o productor pausado). `beats` no tiene columna de slug: las
  páginas del servidor lo agregan con `withProducerSlugs` (`lib/producers.ts`, una
  consulta por página, solo `id, slug`) y viaja como `Beat.producer_slug` y en el
  track del reproductor (`producerSlug`). `PlayerBar` y `BeatRow` no lo enlazan a
  propósito (son zonas de reproducir).
- **Foto y descripción del productor** (migración 024, `producers.bio` y
  `producers.photo_path`): el productor las pone en su portal (`/productor`, sección
  "Tu perfil"). La tienda tiene un molde fijo: la foto llena el círculo de 72 px
  (reemplaza la inicial) y la descripción, de **máximo 160 caracteres** en una sola
  línea, va debajo del sello. No hay portada, colores ni más campos editables, a
  propósito, para que nadie rompa el diseño. Capas: `producer-profile-actions.ts`
  (controlador, el productor sale de la sesión) → `lib/producers/profile-service.ts`
  (reglas y orden: sube la foto nueva, guarda en la base, borra la anterior; si la base
  falla retira la recién subida) → `repository.ts` + `supabase-photo-store.ts`.
  `profile-rules.ts` tiene las reglas puras. La foto vive en el bucket público
  `beats-covers`, en `productores/<id>/foto-<huella>.<ext>` (la base exige ese formato).
  El admin puede quitar la foto desde la tarjeta del productor (`ProducerPhotoControl`).
  `bio` y `photo_path` son **públicos**: `getProducerBySlug` los lee. Correr la
  migración 024 **antes** de desplegar el código: sin las columnas, el portal y las
  tiendas de productor fallan.
- Pendiente: poder reenviar el enlace de la tienda a un productor que ya tenía cuenta.

### Solicitud de cuenta de productor (autoservicio con aprobación)

Un productor nuevo **no** lo crea el admin a mano: pide su cuenta en
`www.lujourban.com/vender/` (página estática escrita a mano, como `/unete/`) y
el admin la aprueba con un clic. Abierto del todo se descartó a propósito:
vende bajo la marca y se le pagará, así que alguien tiene que revisarlo.

- `POST admin.lujourban.com/api/producer-applications` = controlador delgado
  (Origin permitido, cuerpo ≤ 2 KB, campo trampa `website`). **Solo guarda la
  solicitud**: no crea cuentas ni envía correos a quien llena el formulario, así
  nadie puede usar el formulario para mandar correos a terceros.
- Capas: `lib/producer-applications/` → `rules.ts` (puras: `parseApplication`,
  `normalizeMusicUrl` que solo acepta http(s), `parseCommission`, 15 % por
  defecto) → `service.ts` (`submit`, `approve`, `reject`, tope de 20 por hora) →
  `repository.ts` (tabla `producer_applications` y la creación de la fila en
  `producers`) ; `index.ts` = composición. Pruebas con dobles en
  `tests/producer-applications.test.ts`.
- **Aprobar** (`ProducerApplicationService.approve`): reclama la solicitud de
  forma atómica (`UPDATE … WHERE status = 'new'`, dos clics no la aprueban
  dos veces) → crea la ficha en `producers` con la comisión elegida → invita con
  `ProducerAccessService.invite` (mismo enlace de dos pasos de §4.1). Si
  cualquier paso falla, se borra la ficha creada y la solicitud vuelve a "por
  revisar": nunca queda un productor a medias.
- Rechazar solo marca la solicitud. El correo es único: quien repite el
  formulario ve un éxito y no se crea otra fila.
- Migración **021** (`producer_applications`, RLS activo y sin políticas). Hay que
  correrla a mano en Supabase; hasta entonces el panel muestra el aviso.
- `vender` está en `RESERVED_SHORT_LINKS`.
- Pendiente: el portal "en revisión" del diseño original no se hizo, porque
  exigiría crear la cuenta antes de aprobar. Tras aprobar, el productor entra
  directo a `/productor`. Falta además una lista de pasos de perfil (foto,
  historia) y la subida de beats (bloqueada hasta R2).

## 5. Flujo de compra digital (estado actual, ya en producción)

1. El carrito (`CartProvider`, localStorage) hace `POST /api/checkout` con `{ buyer_email, items: [{ beat_id, license_type }] }`.
2. `api/checkout/route.ts`:
   - Recalcula precios server-side desde `beats` (el cliente nunca controla el precio).
   - **Valida cada item**: el beat existe, está `status = 'available'`, la licencia es válida, y existe `file_<licencia>_path` (si falta cualquiera, responde 400 con mensaje claro — no se cobra si no se puede entregar).
   - Crea `orders` (status `pending`) + `order_items` (uno por beat+licencia).
   - Crea una preferencia multi-item en MercadoPago con `external_reference = order.id`, `notification_url` apuntando al webhook, `back_urls` apuntando a `/descarga?order_id=...`.
3. El usuario paga en MercadoPago Checkout Pro.
4. MercadoPago llama a `api/mp-webhook/route.ts` (y además redirige al comprador a `/descarga`):
   - Extrae el `payment_id` del query/body.
   - **Re-consulta el pago contra la API de MercadoPago** (nunca confía en el payload directo del webhook).
   - Si la consulta a MP falla por un error transitorio (no 404), responde **500** para que MercadoPago reintente la notificación. Si el pago no existe (404), responde 200 (no generar reintentos basura).
   - Si `status === 'approved'` → `approveOrder(supabase, orderId, paymentId)`.
   - Si `status === 'rejected'` o `'cancelled'` → marca la orden `rejected` (solo si seguía `pending`).
5. `lib/orders.ts: approveOrder()`:
   - **Idempotencia atómica**: `UPDATE orders SET status='approved', mp_payment_id=... WHERE id=orderId AND status != 'approved'`. Si la fila no se actualiza (ya estaba aprobada), sale sin hacer nada — así webhooks duplicados/concurrentes no generan tokens ni correos repetidos.
   - Si algún `order_item` es licencia `exclusive`, marca ese `beat.status = 'sold_exclusive'` automáticamente.
   - Inserta un row en `downloads` por cada `order_item` (token UUID, expira en 48h, máx. 3 descargas).
   - Envía el correo de descarga vía `lib/email.ts` (Resend).
6. `/descarga?order_id=...`:
   - Si la orden sigue `pending` pero la URL trae `status=approved&payment_id=...` (caso típico de localhost sin webhook), llama `approveOrder` directamente como fallback.
   - Si sigue `pending`, muestra "Procesando tu pago…" y se **auto-refresca cada 5s** (`AutoRefresh.tsx`).
   - Si `rejected`, muestra "Pago no aprobado".
   - Si `approved`, lista cada `order_item` con su botón de descarga (`/api/download/[token]`) y un botón "Volver a la tienda".

## 6. Flujo de descargas

- `api/download/[token]/route.ts`:
  1. Busca el `download` por token (con `order_items(license_type, beats(*))`).
  2. 404 si el token no existe.
  3. 410 si `expires_at` ya pasó.
  4. 410 si `download_count >= max_downloads`.
  5. Resuelve la ruta del archivo según la licencia (`filePathForLicense`).
  6. Genera un **signed URL de 60 segundos** del bucket privado `beats-files` con el nombre de descarga correcto (preserva extensión, incluye `.zip` para stems de exclusiva).
  7. **Consume el uso de forma atómica** via `supabase.rpc('consume_download', { p_id })` — función SQL (migración 009) que incrementa `download_count` y actualiza `used_at` en una sola operación, solo si `download_count < max_downloads`. Si la función devuelve `false`, responde 410.
  8. Redirige al signed URL.

## 7. Manejo de licencias exclusivas

- Tabla `beats.status`: `'available' | 'sold_exclusive'`.
- Al aprobarse una orden con `license_type = 'exclusive'`, el beat correspondiente pasa a `sold_exclusive` **automáticamente** (en `approveOrder`).
- El checkout rechaza (400) cualquier intento de comprar un beat que no esté `available`.
- **Doble venta (migración 016)**: `approve_order_safely` bloquea los beats de la orden (`FOR UPDATE`) y, si una orden todavía no aprobada contiene un beat que ya está `sold_exclusive`, la deja en estado `conflict`: no crea descargas ni ganancias, la tienda manda un aviso a `pedidos@` (o `ORDER_ALERT_TO_EMAIL`) para reembolsar, y `/descarga` le explica al comprador. Se reembolsa a mano desde Mercado Pago.
- El botón manual "Marcar vendido (exclusiva)" / "Marcar disponible" en el panel admin (`actions-beats.ts: toggleBeatStatusAction`) **sigue existiendo y es útil** para ventas externas (fuera de la tienda) o para revertir un estado manualmente.

## 8. Variables de entorno necesarias (sin valores reales)

### `tienda/.env.local` (y Vercel del proyecto tienda)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MERCADOPAGO_ACCESS_TOKEN=
SITE_URL=                    # https://tienda.lujourban.com
RESEND_API_KEY=
```

### `admin/.env.local` (y Vercel del proyecto admin)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SITE_URL=               # https://admin.lujourban.com o panel.lujourban.com
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_BRANCH=
RESEND_API_KEY=               # necesaria para "Reenviar correo de descarga"
TIENDA_URL=                   # https://tienda.lujourban.com — usada para armar los links de descarga en el correo reenviado (si falta, usa ese valor por defecto)
```

> Nota: aunque ambos proyectos usan el **mismo proyecto Supabase**, cada
> proyecto de Vercel tiene su propio set de variables — no asumir que están
> sincronizadas.

## 9. Comandos de verificación / build / typecheck

Cada app (`tienda/`, `admin/`) es un proyecto Next.js independiente:

```bash
cd tienda   # o admin
npx tsc --noEmit -p tsconfig.json   # typecheck
npm run build                       # build de producción (detecta errores de Next/React también)
npm run dev                         # servidor local (next dev)
```

`admin/` tiene pruebas automatizadas con Vitest (`admin/tests/`):

```bash
cd admin
npm test            # corre todas las pruebas una vez (vitest run)
npm run test:watch  # modo observador mientras se programa
```

Cubren la lista de espera (`waitlist.ts`), los clics por enlace (`link-clicks.ts`), el enlace corto (`short-link.ts`) y la capa de artistas: `errors.ts`, `safeAction`, `ArtistService`
(reglas y orden de operaciones), `SupabaseArtistRepository` (traducción de
errores de Postgres), `commitFiles` (borrado y reintento en 422) y
`GithubSitePublisher`. Todo corre con dobles en memoria (`tests/helpers.ts`,
`tests/fake-supabase.ts`, `tests/fake-github.ts`): sin red, sin secretos y sin
tocar Supabase ni GitHub reales. Al cambiar el servicio, el repositorio o el
publicador, agregar o ajustar la prueba que corresponda.

`tienda/` todavía no tiene pruebas. Después de tocar checkout, webhook,
`orders.ts`, descargas o el panel de beats/órdenes, correr **typecheck + build**
de la app afectada como mínimo.

GitHub Actions (`.github/workflows/ci.yml`) corre en cada PR y en cada push a
`main`: `tsc`, pruebas y `next build` de `admin/`, y `tsc` de `tienda/`.

## 10. Reglas para futuros agentes

- **Auditar y proponer un plan antes de modificar** código de pagos, webhooks
  o descargas — explicar el riesgo antes de tocar nada.
- **No sobreingenierizar**: cambios quirúrgicos, sin rehacer arquitectura ya
  validada en producción.
- **No tocar secretos**: nunca pegar API keys, tokens o valores reales de
  `.env.local` en código, commits o documentación.
- **No cambiar el flujo de pagos/webhooks/descargas sin explicar riesgos**
  primero al usuario.
- **Compra como invitado**: no introducir login obligatorio para comprar.
  Login es opcional y solo para una v2 (historial de compras).
- **Identidad visual**: mantener la paleta y tono "Lujo Urban" — premium,
  urbano, negro/dorado.
- Después de cambios importantes: correr `npx tsc --noEmit` y `npm run build`
  en la(s) app(s) afectada(s) antes de dar por terminada la tarea.
- **Permisos de RPC en Supabase**: `revoke ... from public` NO basta. Supabase le da
  EXECUTE explícito a `anon` y `authenticated`, así que toda función nueva debe
  hacer `revoke execute ... from public, anon, authenticated` y `grant ... to service_role`
  (ver migración 015). Si no, cualquiera con la publishable key la puede llamar.
- Las migraciones SQL (`supabase/migrations/*.sql`) son incrementales y se
  corren **a mano** en el SQL Editor de Supabase — un agente no puede
  ejecutarlas directamente (no hay conexión Postgres ni endpoint de SQL
  arbitrario disponible). Si una tarea requiere una migración, crear el
  archivo `.sql` y pedirle al usuario que la corra.
- Tras un cambio de código en `tienda/` o `admin/`, el `git push` final lo
  hace el usuario manualmente (las credenciales de GitHub no están
  disponibles en el entorno del agente).

## 11. Pendientes / Segunda versión (V2)

- Panel de órdenes más completo (filtros, búsqueda, exportar).
- Registrar el estado del envío de email (enviado / fallido) en la orden.
- Validar la firma `x-signature` del webhook de MercadoPago (hardening extra
  sobre la verificación actual, que ya re-consulta el pago contra la API de MP).
- Historial de compras del cliente vía magic link por correo (login opcional,
  nunca obligatorio para comprar).
- Limpieza periódica de órdenes `pending` antiguas/abandonadas.
- **Reserva temporal de exclusivas**: columna `beats.reserved_until` que el
  checkout llene (p. ej. 15 min) al iniciar una compra exclusiva, para que nadie
  más pueda abrir checkout de ese beat mientras siga vigente. Hoy la doble venta
  se ataja después del pago (estado `conflict` + reembolso manual, migración
  016); la reserva evitaría que el conflicto llegue a ocurrir.
- Cupones de descuento (tabla `coupons`).
- Dashboard de ventas (totales por beat/licencia/fecha).
- Marca de agua / voz periódica en los previews de audio.
- Mejoras visuales/UX adicionales en la tienda (beats relacionados, etc.).
- Quitar definitivamente el bloque de "beats de prueba" duplicados en
  `tienda/app/page.tsx` una vez haya suficiente catálogo real (hoy
  controlado por el toggle "Mostrar/Ocultar beats de prueba" en el admin,
  tabla `app_settings`).
