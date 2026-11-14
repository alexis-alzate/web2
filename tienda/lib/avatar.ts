// Tono del avatar de un productor sin foto. Es determinista: el mismo slug
// siempre da el mismo tono, asi cada tienda tiene su propia identidad sin
// guardar nada. Los tonos (todos de la paleta de Lujo Urban) viven en CSS
// como `data-tone`.

export const AVATAR_TONES = 5;

export const avatarTone = (seed: string): number => {
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % AVATAR_TONES;
};
