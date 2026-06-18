import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  normalizeBeatMetadata,
  storageTargetForUpload,
  validateUploadFiles,
  type BeatUploadFileInput,
  type BeatUploadMetadata
} from '@/lib/beat-upload';

type UploadUrlRequest = {
  metadata?: BeatUploadMetadata;
  files?: BeatUploadFileInput[];
};

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as UploadUrlRequest | null;
  if (!body?.metadata) {
    return NextResponse.json({ error: 'Faltan los datos del beat.' }, { status: 400 });
  }

  const files = body.files ?? [];
  const supabase = createSupabaseAdminClient();

  try {
    const metadata = normalizeBeatMetadata(body.metadata);
    validateUploadFiles(files);

    const { data: existing } = await supabase
      .from('beats')
      .select('id')
      .eq('slug', metadata.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `Ya existe un beat con el slug "${metadata.slug}".` }, { status: 409 });
    }

    const uploads = [];
    for (const file of files) {
      const target = storageTargetForUpload(metadata.slug, file);
      const { data, error } = await supabase
        .storage
        .from(target.bucket)
        .createSignedUploadUrl(target.path, { upsert: true });

      if (error || !data) {
        return NextResponse.json({ error: `No se pudo preparar la subida de ${file.name}.` }, { status: 500 });
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

    return NextResponse.json({ slug: metadata.slug, uploads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo preparar la subida.' },
      { status: 400 }
    );
  }
}
