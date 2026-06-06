# Panel Admin Lujo Urban

Panel online privado para administrar Lujo Urban desde celular o navegador.

La web publica sigue siendo el sitio estatico actual. Este panel vive aparte y
escribe cambios en GitHub usando la API.

## Variables

Configura estas variables en Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
ADMIN_SITE_URL=https://panel.lujourban.com
GITHUB_TOKEN=github_pat_xxx
GITHUB_OWNER=alexis-alzate
GITHUB_REPO=web2
GITHUB_BRANCH=main
```

El acceso al panel se administra desde Supabase Auth. Crea el usuario en
Supabase usando el correo que usaras para entrar al panel.

En Supabase configura estas URLs:

```text
Site URL: https://panel.lujourban.com
Redirect URL: https://panel.lujourban.com/auth/callback
Redirect URL: https://panel.lujourban.com/reset-password
```

El token de GitHub debe poder leer y escribir contenido del repo.
La clave del panel se cambia desde el flujo de recuperacion de Supabase.

## Local

```bash
npm install
npm run dev:local
```

Abre:

```text
http://127.0.0.1:3000
```

Para probar desde otro dispositivo en la misma red:

```bash
npm run dev:network
```

## Vercel

Este panel debe vivir como proyecto separado, usando esta carpeta como root:

```text
admin
```

Configuracion recomendada:

```text
Framework Preset: Next.js
Root Directory: admin
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

Luego configura las variables de entorno en Vercel y agrega un dominio como:

```text
admin.lujourban.com
```

No uses este panel para reemplazar la web publica principal. Es un proyecto separado de administracion.

## Estado MVP

Incluye:

- Login de usuario unico.
- Login con Supabase Auth.
- Recuperacion de clave por correo.
- Panel responsive con secciones desplegables.
- Lectura y edicion de artistas desde `artist-data.json`.
- Ordenar artistas del roster.
- Borrar artistas con confirmacion.
- Crear y reactivar lanzamientos principales de Zaetta.
- Crear y reactivar lanzamientos de artistas.
- Reconstruccion de `artistas/index.html`, perfiles de artistas y `sitemap.xml`.
- Crear nuevo lanzamiento principal de Zaetta.
- Reactivar lanzamiento principal de Zaetta.
- Commits directos a GitHub.

Pendiente para la siguiente iteracion:

- Subida de fotos/portadas desde el navegador.
- Mensajes visuales de exito/error despues de publicar.
- Dominio privado `panel.lujourban.com`.
