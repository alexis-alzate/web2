import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { BIO_MAX_LENGTH, isProducerPhotoPath, ownsPhotoPath, parseBio } from '@/lib/producers/profile-rules';
import { ProducerProfileService } from '@/lib/producers/profile-service';
import type { ProducerPhotoStore, ProducerProfile, ProducerRepository } from '@/lib/producers/types';
import { PRODUCER } from './producer-helpers';

const ID = '3f2c1b0a-1111-4222-8333-444455556666';
const OTHER_ID = '9a8b7c6d-aaaa-4bbb-8ccc-ddddeeeeffff';
const photoPath = (id: string, hash = 'abcdef012345', ext = 'jpg') => `productores/${id}/foto-${hash}.${ext}`;

class FakePhotos implements ProducerPhotoStore {
  saved: string[] = [];
  removed: string[] = [];
  failSave = false;
  failRemove = false;
  private count = 0;

  async save(producerId: string, image: { extension: 'jpg' | 'png' | 'webp' }) {
    if (this.failSave) throw new Error('storage caido');
    this.count += 1;
    const path = photoPath(producerId, String(this.count).padStart(12, '0'), image.extension);
    this.saved.push(path);
    return path;
  }

  async remove(path: string) {
    this.removed.push(path);
    if (this.failRemove) throw new Error('no se pudo borrar');
  }
}

class FakeProducers implements Pick<ProducerRepository, 'findById' | 'updateProfile'> {
  updates: Array<{ id: string; bio: string | null; photoPath: string | null }> = [];
  failUpdate = false;
  constructor(public producer: ProducerProfile | null) {}

  async findById(id: string) {
    return this.producer && this.producer.id === id ? { ...this.producer } : null;
  }

  async updateProfile(id: string, changes: { bio: string | null; photoPath: string | null }) {
    if (this.failUpdate) throw new Error('base caida');
    this.updates.push({ id, ...changes });
    if (this.producer) this.producer = { ...this.producer, ...changes };
  }
}

const build = (overrides: Partial<ProducerProfile> = {}, exists = true) => {
  const producers = new FakeProducers(exists ? { ...PRODUCER, id: ID, ...overrides } : null);
  const photos = new FakePhotos();
  const service = new ProducerProfileService(producers as unknown as ProducerRepository, photos);
  return { producers, photos, service };
};

const image = { extension: 'jpg' as const, contentBase64: 'AAAA' };

describe('parseBio', () => {
  it('vacío o solo espacios = sin descripción', () => {
    expect(parseBio('')).toBeNull();
    expect(parseBio('   \n  ')).toBeNull();
    expect(parseBio(undefined)).toBeNull();
  });

  it('une saltos de línea y espacios de más en una sola línea', () => {
    expect(parseBio('  Trap   y\n\ndrill  ')).toBe('Trap y drill');
  });

  it('quita caracteres de control', () => {
    expect(parseBio('Hola\u0007 mundo')).toBe('Hola mundo');
  });

  it('acepta exactamente el máximo y rechaza uno más', () => {
    expect(parseBio('a'.repeat(BIO_MAX_LENGTH))).toHaveLength(BIO_MAX_LENGTH);
    expect(() => parseBio('a'.repeat(BIO_MAX_LENGTH + 1))).toThrow(ValidationError);
  });

  it('cuenta caracteres, no bytes (tildes y emojis)', () => {
    expect(parseBio('ñ'.repeat(BIO_MAX_LENGTH))).not.toBeNull();
    expect(() => parseBio('😀'.repeat(BIO_MAX_LENGTH + 1))).toThrow(ValidationError);
  });
});

describe('rutas de foto', () => {
  it('acepta solo el formato productores/<id>/foto-<huella>.<ext>', () => {
    expect(isProducerPhotoPath(photoPath(ID))).toBe(true);
    expect(isProducerPhotoPath(photoPath(ID, 'abcdef012345', 'png'))).toBe(true);
    expect(isProducerPhotoPath(`productores/${ID}/foto-abc.jpg`)).toBe(false);
    expect(isProducerPhotoPath(`productores/${ID}/foto-abcdef012345.gif`)).toBe(false);
    expect(isProducerPhotoPath('beats/portada.jpg')).toBe(false);
    expect(isProducerPhotoPath(`productores/${ID}/../x/foto-abcdef012345.jpg`)).toBe(false);
  });

  it('solo es del productor si cuelga de su carpeta', () => {
    expect(ownsPhotoPath(ID, photoPath(ID))).toBe(true);
    expect(ownsPhotoPath(ID, photoPath(OTHER_ID))).toBe(false);
  });
});

describe('ProducerProfileService.update', () => {
  it('guarda solo la descripción sin tocar la foto', async () => {
    const { service, producers, photos } = build({ photoPath: photoPath(ID) });
    await service.update(ID, { bio: 'Hola', photo: null, removePhoto: false });
    expect(producers.updates).toEqual([{ id: ID, bio: 'Hola', photoPath: photoPath(ID) }]);
    expect(photos.saved).toEqual([]);
    expect(photos.removed).toEqual([]);
  });

  it('sube la foto nueva, la guarda y borra la anterior', async () => {
    const old = photoPath(ID, 'aaaaaaaaaaaa');
    const { service, producers, photos } = build({ photoPath: old });
    await service.update(ID, { bio: '', photo: image, removePhoto: false });
    expect(photos.saved).toHaveLength(1);
    expect(producers.updates[0].photoPath).toBe(photos.saved[0]);
    expect(photos.removed).toEqual([old]);
  });

  it('quitar la foto la borra y deja la ruta vacía', async () => {
    const old = photoPath(ID);
    const { service, producers, photos } = build({ photoPath: old, bio: 'Hola' });
    await service.update(ID, { bio: 'Hola', photo: null, removePhoto: true });
    expect(producers.updates[0]).toEqual({ id: ID, bio: 'Hola', photoPath: null });
    expect(photos.removed).toEqual([old]);
  });

  it('una foto nueva gana sobre "quitar"', async () => {
    const { service, producers, photos } = build({ photoPath: photoPath(ID) });
    await service.update(ID, { bio: '', photo: image, removePhoto: true });
    expect(producers.updates[0].photoPath).toBe(photos.saved[0]);
  });

  it('una descripción inválida no sube ni guarda nada', async () => {
    const { service, producers, photos } = build();
    await expect(service.update(ID, { bio: 'a'.repeat(200), photo: image, removePhoto: false }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(photos.saved).toEqual([]);
    expect(producers.updates).toEqual([]);
  });

  it('si la base falla, retira la foto recién subida y conserva la anterior', async () => {
    const old = photoPath(ID, 'aaaaaaaaaaaa');
    const { service, producers, photos } = build({ photoPath: old });
    producers.failUpdate = true;
    await expect(service.update(ID, { bio: '', photo: image, removePhoto: false })).rejects.toThrow('base caida');
    expect(photos.removed).toEqual(photos.saved);
    expect(photos.removed).not.toContain(old);
  });

  it('si falla al borrar la foto anterior, el perfil igual queda guardado', async () => {
    const { service, producers, photos } = build({ photoPath: photoPath(ID, 'aaaaaaaaaaaa') });
    photos.failRemove = true;
    await expect(service.update(ID, { bio: '', photo: image, removePhoto: false })).resolves.toBeUndefined();
    expect(producers.updates).toHaveLength(1);
  });

  it('si falla la subida no toca la base', async () => {
    const { service, producers, photos } = build();
    photos.failSave = true;
    await expect(service.update(ID, { bio: 'Hola', photo: image, removePhoto: false })).rejects.toThrow('storage caido');
    expect(producers.updates).toEqual([]);
  });

  it('no borra una ruta anterior que no es de este productor', async () => {
    const foreign = photoPath(OTHER_ID);
    const { service, photos } = build({ photoPath: foreign });
    await service.update(ID, { bio: '', photo: image, removePhoto: false });
    expect(photos.removed).toEqual([]);
  });

  it('rechaza a un productor pausado y a uno que no existe', async () => {
    const paused = build({ status: 'inactive' });
    await expect(paused.service.update(ID, { bio: 'x', photo: null, removePhoto: false })).rejects.toBeInstanceOf(ForbiddenError);
    expect(paused.producers.updates).toEqual([]);

    const missing = build({}, false);
    await expect(missing.service.update(ID, { bio: 'x', photo: null, removePhoto: false })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ProducerProfileService.removePhoto (admin)', () => {
  it('quita la foto, conserva la descripción y borra el archivo', async () => {
    const old = photoPath(ID);
    const { service, producers, photos } = build({ photoPath: old, bio: 'Hola' });
    await service.removePhoto(ID);
    expect(producers.updates).toEqual([{ id: ID, bio: 'Hola', photoPath: null }]);
    expect(photos.removed).toEqual([old]);
  });

  it('sin foto no hace nada', async () => {
    const { service, producers } = build();
    await service.removePhoto(ID);
    expect(producers.updates).toEqual([]);
  });

  it('un productor inexistente da NotFound', async () => {
    const { service } = build({}, false);
    await expect(service.removePhoto(ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});
