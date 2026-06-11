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
│   └── migrations/                           # 001..009, SQL incremental, se corre a mano en Supabase SQL Editor
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
    ├── app/
    │   ├── page.tsx                          # dashboard principal (todas las secciones)
    │   ├── actions-beats.ts                  # CRUD de beats, upload a Storage, toggle demo beats
    │   ├── actions-orders.ts                 # listar órdenes, reenviar correo de descarga
    │   ├── actions.ts                        # acciones de contenido del sitio estático (GitHub)
    │   ├── auth-actions.ts, auth/, login/, forgot-password/, reset-password/
    │   ├── api/                              # endpoints internos del panel
    │   └── components/                       # ActionForm, SubmitButton, AnalyticsDashboard, etc.
    └── lib/
        ├── beats.ts                          # tipos Beat/LicenseType, slugify, beatCoverUrl, LICENSE_LABELS
        ├── email.ts                          # sendDownloadEmail() via fetch a Resend API (sin SDK)
        ├── auth.ts, admin-session.ts         # auth del panel (Supabase Auth)
        ├── github.ts, artist-renderer.ts     # edición del sitio estático vía API de GitHub
        ├── analytics.ts                      # métricas de lanzamientos
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

No hay test suite automatizada todavía. Después de tocar checkout, webhook,
`orders.ts`, descargas o el panel de beats/órdenes, correr **typecheck + build**
de la app afectada como mínimo.

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
- Cupones de descuento (tabla `coupons`).
- Dashboard de ventas (totales por beat/licencia/fecha).
- Marca de agua / voz periódica en los previews de audio.
- Mejoras visuales/UX adicionales en la tienda (beats relacionados, etc.).
- Quitar definitivamente el bloque de "beats de prueba" duplicados en
  `tienda/app/page.tsx` una vez haya suficiente catálogo real (hoy
  controlado por el toggle "Mostrar/Ocultar beats de prueba" en el admin,
  tabla `app_settings`).
