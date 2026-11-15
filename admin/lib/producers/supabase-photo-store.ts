// Unico archivo que guarda y borra fotos de productores en Supabase Storage.
// Usan el bucket publico `beats-covers` (el mismo de las portadas de beats),
// siempre bajo `productores/<id>/`.

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProducerPhotoStore } from './types';

const BUCKET = 'beats-covers';

const CONTENT_TYPE = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export class SupabaseProducerPhotoStore implements ProducerPhotoStore {
  constructor(private readonly client: () => SupabaseClient) {}

  async save(producerId: string, image: { extension: 'jpg' | 'png' | 'webp'; contentBase64: string }) {
    const buffer = Buffer.from(image.contentBase64, 'base64');
    // La huella del contenido cambia con cada foto distinta: la direccion nueva
    // evita que el navegador o la CDN sigan mostrando la anterior.
    const fingerprint = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    const path = `productores/${producerId}/foto-${fingerprint}.${image.extension}`;

    const { error } = await this.client()
      .storage.from(BUCKET)
      .upload(path, buffer, { contentType: CONTENT_TYPE[image.extension], upsert: true });
    if (error) throw new Error(`No pude subir la foto: ${error.message}`);
    return path;
  }

  async remove(path: string) {
    const { error } = await this.client().storage.from(BUCKET).remove([path]);
    if (error) throw new Error(`No pude borrar la foto: ${error.message}`);
  }
}
