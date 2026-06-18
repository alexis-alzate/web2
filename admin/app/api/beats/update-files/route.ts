import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  storageTargetForUpload,
  validateUploadFiles,
  type BeatStoragePath,
  type BeatUploadFileInput,
  type UploadField
} from '@/lib/beat-upload';

type UpdateFilesRequest = {
  step?: 'prepare' | 'finalize';
  beat_id?: string;
  files?: BeatUploadFileInput[];
  uploads?: BeatStoragePath[];
};

const fileColumnByField: Partial<Record<UploadField, string>> = {
  cover: 'cover_url',
  preview: 'preview_url',
  basic: 'file_basic_path',
  premium: 'file_premium_path',
  exclusive: 'file_exclusive_path'
};

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as UpdateFilesRequest | null;
  if (!body?.beat_id) {
    return NextResponse.json({ error: 'Falta el beat.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: beat, error: beatError } = await supabase
    .from('beats')
    .select('id, slug')
    .eq('id', body.beat_id)
    .single();

  if (beatError || !beat) {
    return NextResponse.json({ error: 'No se encontro el beat.' }, { status: 404 });
  }

  if (body.step === 'prepare') {
    const files = body.files ?? [];

    try {
      validateUploadFiles(files);

      const uploads = [];
      for (const file of files) {
        const target = storageTargetForUpload(beat.slug, file);
        const { data, error } = await supabase
          .storage
          .from(target.bucket)
          .createSignedUploadUrl(target.path, { upsert: true });

        if (error || !data) {
          return NextResponse.json({ error: `No se pudo preparar ${file.name}.` }, { status: 500 });
        }

        uploads.push({
          field: file.field,
          name: file.name,
          size: file.size,
          type: file.type,
          bucket: target.bucket,
          path: target.path,
          signedUrl: data.signedUrl
        });
      }

      return NextResponse.json({ uploads });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'No se pudo preparar la subida.' },
        { status: 400 }
      );
    }
  }

  if (body.step === 'finalize') {
    const uploads = body.uploads ?? [];
    const update: Record<string, string> = {};

    for (const upload of uploads) {
      const column = fileColumnByField[upload.field];
      if (column) update[column] = upload.path;
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'No hay archivos para guardar.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('beats')
      .update(update)
      .eq('id', body.beat_id);

    if (error) {
      return NextResponse.json({ error: `No se pudieron guardar los archivos: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Paso invalido.' }, { status: 400 });
}
