# Panel Admin Lujo Urban

Panel online privado para administrar Lujo Urban desde celular o navegador.

La web publica sigue siendo el sitio estatico actual. Este panel vive aparte y
escribe cambios en GitHub usando la API.

## Variables

Configura estas variables en Vercel:

```text
ADMIN_USER=tu_usuario
ADMIN_PASSWORD=tu_clave_larga
ADMIN_SESSION_SECRET=otra_clave_larga_para_firmar_cookie
GITHUB_TOKEN=github_pat_xxx
GITHUB_OWNER=alexis-alzate
GITHUB_REPO=web2
GITHUB_BRANCH=main
```

El token de GitHub debe poder leer y escribir contenido del repo.

## Local

```bash
npm install
npm run dev
```

Abre:

```text
http://localhost:3000
```

## Vercel

Crea un proyecto nuevo en Vercel usando esta carpeta como root:

```text
admin
```

No uses este panel para reemplazar la web publica principal. Es un proyecto
separado de administracion.

## Estado MVP

Incluye:

- Login de usuario unico.
- Lectura de artistas desde `artist-data.json`.
- Lectura de lanzamientos desde `release-history.json`.
- Crear nuevo lanzamiento principal de Zaetta.
- Reactivar lanzamiento principal de Zaetta.
- Commits directos a GitHub.

Pendiente para la siguiente iteracion:

- Crear/editar artistas desde el panel online.
- Mover artistas del roster.
- Agregar/reactivar lanzamientos de artistas.
- Subida de fotos/portadas manuales.
