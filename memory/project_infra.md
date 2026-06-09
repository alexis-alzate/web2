---
name: project-infra
description: Infraestructura y configuración del sitio zaetta-landing — dominio, hosting, Search Console, deploy
metadata:
  type: project
---

Configuración confirmada del sitio en producción.

**Why:** Evitar confusiones sobre dominios, www, deploy y herramientas conectadas.

**How to apply:** Cuando se hagan cambios que requieran deploy o se toque SEO/dominio, usar esta info como referencia.

## Dominio
- Dominio principal: `www.lujourban.com` (con www)
- `lujourban.com` sin www hace 307 redirect a `www.lujourban.com`
- Subdominio del sello: `casa.lujourban.com` → proyecto `lujourban-vision/` en el repo

## Hosting y deploy
- Hospedado en **Vercel**
- Repo de GitHub conectado a Vercel → push = deploy automático

## Google Search Console
- Verificado como **propiedad de dominio** (DNS TXT record)
- Cubre automáticamente www, sin www, y todos los subdominios

## Cambios aplicados (2026-06-09)
- JSON-LD mejorado a @graph con MusicRecordings en index.html
- OG tags agregados a lujourban-vision/index.html (casa.lujourban.com)
