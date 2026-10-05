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
├── artistas/, lanzamientos/, servicios/, estados/  # contenido del sitio estático
├── lujourban-vision/                         # micrositio casa.lujourban.com
├── *.mjs, panel.sh, publicar.sh              # scripts de gestión de contenido estático
├── supabase/
│   └── migrations/                           # 001..017, SQL incremental, se corre a mano en Supabase SQL Editor
├── tienda/                                    # Next.js — tienda de beats (pública)
│   ├── app/
│   │   ├── page.tsx                          # catálogo (server component)
│   │   ├── [slug]/page.tsx                   # detalle de beat + SEO
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
│   │   ├── format.ts                         # formatCOP, formatTime, publicUrl
│   │   └── supabase/server.ts                # clientes anon (catálogo) y service-role (route handlers)
│   └── .env.example
└── admin/                                     # Next.js — panel privado
    ├── app/                                  # SOLO lo que Next exige: rutas (page/layout/route.ts), delgadas
    │   ├── page.tsx                          # dashboard principal (pendiente: partirlo en secciones)
    │   ├── api/                              # endpoints internos del panel (route.ts)
    │   ├── auth/, login/, forgot-password/, reset-password/, mi-perfil/
    │   └── layout.tsx
    ├── frontend/                             # TODO lo que se ve o corre en el navegador
    │   ├── components/                       # common/ (ActionForm, SubmitButton...), auth/, beats/, artists/, panel/
    │   ├── styles/globals.css
    │   └── lib/supabase-browser.ts           # cliente de Supabase para el navegador (passkeys)
    ├── backend/                              # TODO lo que corre en el servidor
    │   ├── actions/                          # Server Actions = controllers: content.ts (sitio estatico/GitHub), beats.ts, orders.ts,
    │   │                                     #   producers.ts, artist-access.ts, artist-portal.ts, auth.ts
    │   ├── artists/                          # capa de artistas: index.ts (composicion) → service.ts (reglas) → repository.ts (BD)
    │   │                                     #   + site-publisher.ts (GitHub), images.ts, release-pages.ts, types.ts, test-artist.ts
    │   ├── core/                             # errors.ts (errores con tipo), safe-action.ts (traductor de errores), app-origin.ts
    │   ├── integrations/                     # github.ts (commitFiles: borra y reintenta), email.ts (Resend por fetch), artist-renderer.ts
    │   ├── auth/auth.ts                      # auth del panel (Supabase Auth)
    │   ├── supabase/                         # admin-client.ts (service-role), server.ts
    │   └── services/                         # analytics.ts (métricas de lanzamientos), portal-activity.ts
    ├── shared/                               # puro y sin secretos: lo importan frontend Y backend
    │   └── beats.ts, beat-upload.ts, socials.ts, admin-session.ts, portal-activity-types.ts
    ├── proxy.ts                              # middleware de Next (debe estar en la raiz)
    └── tests/                                # Vitest (ver seccion 9)
```

### Dónde va cada cosa en `admin/` (regla de carpetas)

Next.js obliga a que `page.tsx`, `layout.tsx` y `route.ts` vivan dentro de `app/`,
así que las dos mitades se separan por carpetas, no por proyecto:

- `frontend/` importa de `shared/` y de sí misma. **Nunca de `backend/`** (un
  `import type` está bien; un import de valores arrastraría código y secretos
  del servidor al navegador).
- `backend/` importa de `shared/` y de sí misma. Nunca de `frontend/`.
- `shared/` no importa de ninguna de las dos y no toca `process.env` secretos.
- `app/` solo conecta: una página arma componentes de `frontend/` con datos de
  `backend/`; un `route.ts` o una Server Action delega en `backend/`.
- Archivo nuevo: ¿corre en el navegador? → `frontend/`. ¿Habla con Supabase,
  GitHub, Resend o lee secretos? → `backend/`. ¿Constante o tipo puro que usan
  ambos? → `shared/`.

## 3. Tienda pública vs. Admin — diferencia clave

| | `tienda/` | `admin/` |
|---|---|---|
| Audiencia | Pública (clientes) | Privada (solo Zaetta/equipo) |
| Auth | Ninguna (compra como invitado) | Supabase Auth (login obligatorio) |
| Acceso a Supabase | Cliente anon (catálogo, solo lectura con RLS) + service-role (route handlers de checkout/webhook/descarga) | Siempre service-role (`admin/backend/supabase/admin-client.ts`) |
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
Server Action = controller   (backend/actions/content.ts, artist-portal.ts)
   lee el formulario, comprueba permisos, llama al servicio. Envuelta en safeAction.
   └─ ArtistService          (backend/artists/service.ts)
        reglas Y validaciones, orden de operaciones, qué publicar o borrar.
        Recibe por constructor (inyección de dependencias):
        ├─ ArtistRepository  → SupabaseArtistRepository (repository.ts): único que toca las tablas
        ├─ SitePublisher     → GithubSitePublisher (site-publisher.ts): sabe dónde viven las páginas
        └─ CoverFetcher      → fetchSmartLinkCover (images.ts)
   backend/artists/index.ts = raíz de composición: único lugar que elige las implementaciones
safeAction (backend/core/safe-action.ts) = @RestControllerAdvice: atrapa los errores con tipo
   y devuelve { ok: false, code, message }; los inesperados se registran y se muestran genéricos.
```

- **Errores**: las capas lanzan errores con tipo de `backend/core/errors.ts`
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
- Subidas de imagen: solo JPG/PNG/WebP de hasta 5 MB (`backend/artists/images.ts`).
- Pendiente: vincular usuarios por `artist_access` en lugar de
  `app_metadata.lujo_artist_slug` (hoy el slug en metadatos sigue siendo lo
  que usa `getCurrentAccess`; renombrar o borrar un artista deja ese slug
  desactualizado).

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
- El botón manual "Marcar vendido (exclusiva)" / "Marcar disponible" en el panel admin (`admin/backend/actions/beats.ts: toggleBeatStatusAction`) **sigue existiendo y es útil** para ventas externas (fuera de la tienda) o para revertir un estado manualmente.

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

Cubren la capa de artistas: `errors.ts`, `safeAction`, `ArtistService`
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
