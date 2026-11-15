// Reglas del perfil publico del productor (foto y descripcion corta).
//
// Quien llama (la Server Action) ya comprobo la sesion y pasa el id del
// productor DE LA SESION; aqui solo se aplican las reglas. Orden de
// operaciones: primero se sube la foto nueva, despues se guarda en la base, y
// al final se borra la anterior. Si la base falla, se retira la foto recien
// subida para no dejar archivos huerfanos.

import type { UploadedImage } from '@/lib/artists/images';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { ownsPhotoPath, parseBio } from './profile-rules';
import type { ProducerPhotoStore, ProducerRepository } from './types';

export type ProfileChanges = {
  // Texto tal cual lo escribio; vacio = sin descripcion.
  bio: string;
  // Foto nueva (ya validada en tipo y peso). Null = no cambiarla.
  photo: UploadedImage | null;
  removePhoto: boolean;
};

export class ProducerProfileService {
  constructor(
    private readonly producers: ProducerRepository,
    private readonly photos: ProducerPhotoStore
  ) {}

  async update(producerId: string, changes: ProfileChanges): Promise<void> {
    const producer = await this.producers.findById(producerId);
    if (!producer) throw new NotFoundError('No encontré tu cuenta de productor.');
    if (producer.status !== 'active') {
      throw new ForbiddenError('Tu cuenta de productor no está activa. Contacta a Lujo Urban.');
    }

    // Se valida todo ANTES de tocar el almacenamiento.
    const bio = parseBio(changes.bio);
    const previousPath = producer.photoPath;

    let photoPath = previousPath;
    let uploadedPath: string | null = null;
    if (changes.photo) {
      uploadedPath = await this.photos.save(producerId, changes.photo);
      photoPath = uploadedPath;
    } else if (changes.removePhoto) {
      photoPath = null;
    }

    try {
      await this.producers.updateProfile(producerId, { bio, photoPath });
    } catch (error) {
      if (uploadedPath && uploadedPath !== previousPath) {
        await this.photos.remove(uploadedPath).catch(() => undefined);
      }
      throw error;
    }

    // La foto anterior ya no se usa. Si no se puede borrar no pasa nada
    // grave: queda un archivo suelto, pero el perfil ya quedo bien.
    if (previousPath && previousPath !== photoPath && ownsPhotoPath(producerId, previousPath)) {
      await this.photos.remove(previousPath).catch(() => undefined);
    }
  }

  // El admin quita la foto de un productor (por ejemplo si sube algo que no va).
  async removePhoto(producerId: string): Promise<void> {
    const producer = await this.producers.findById(producerId);
    if (!producer) throw new NotFoundError('No encontré a ese productor.');
    if (!producer.photoPath) return;

    await this.producers.updateProfile(producerId, { bio: producer.bio, photoPath: null });
    if (ownsPhotoPath(producerId, producer.photoPath)) {
      await this.photos.remove(producer.photoPath).catch(() => undefined);
    }
  }
}
