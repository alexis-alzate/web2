import { describe, expect, it } from 'vitest';
import { validateUploadFiles, type BeatUploadFileInput } from '@/lib/beat-upload';

const file = (field: BeatUploadFileInput['field'], name: string, size: number): BeatUploadFileInput => ({
  field,
  name,
  size,
  type: 'audio/mpeg'
});

describe('validateUploadFiles', () => {
  it('rechaza un preview que es el mismo archivo que se vende', () => {
    expect(() =>
      validateUploadFiles([file('preview', 'Arambi2.mp3', 5_986_080), file('basic', 'Arambi2.mp3', 5_986_080)])
    ).toThrow(/mismo archivo/);
  });

  it('acepta un preview distinto del archivo de venta', () => {
    expect(() =>
      validateUploadFiles([file('preview', 'arambi-tag.mp3', 1_200_000), file('basic', 'Arambi2.mp3', 5_986_080)])
    ).not.toThrow();
  });

  it('no confunde dos archivos con el mismo nombre y distinto peso', () => {
    expect(() =>
      validateUploadFiles([file('preview', 'beat.mp3', 1_000_000), file('basic', 'beat.mp3', 6_000_000)])
    ).not.toThrow();
  });

  it('acepta una subida sin preview', () => {
    expect(() => validateUploadFiles([file('basic', 'beat.mp3', 6_000_000)])).not.toThrow();
  });
});
