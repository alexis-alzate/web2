-- Perfil publico del productor: foto y descripcion corta.
--
-- La foto vive en el bucket publico `beats-covers`, en
-- `productores/<id del productor>/foto-<huella>.<ext>`: la huella del contenido
-- hace que una foto nueva no quede tapada por cache. La base solo guarda la
-- ruta y exige ese formato, asi nadie apunta a un archivo ajeno.
--
-- ATENCION: `bio` y `photo_path` se muestran en la tienda publica. La tabla
-- `producers` sigue sin politicas de lectura (guarda correo y comision); la
-- tienda lee solo columnas concretas con el cliente de servicio.

alter table producers
  add column if not exists bio text,
  add column if not exists photo_path text;

alter table producers drop constraint if exists producers_bio_length;
alter table producers
  add constraint producers_bio_length
  check (bio is null or char_length(bio) <= 160);

alter table producers drop constraint if exists producers_photo_path_format;
alter table producers
  add constraint producers_photo_path_format
  check (
    photo_path is null
    or photo_path ~ '^productores/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/foto-[0-9a-f]{12}\.(jpg|png|webp)$'
  );
