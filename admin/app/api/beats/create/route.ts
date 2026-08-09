import { NextResponse } from 'next/server';
import { getCurrentAccess } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  normalizeBeatMetadata,
  type BeatStoragePath,
  type BeatUploadMetadata,
  type UploadField
} from '@/lib/beat-upload';

type CreateBeatRequest = {
  metadata?: BeatUploadMetadata;
  uploads?: BeatStoragePath[];
};

const cleanupUploadedFiles = async (
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  uploads: BeatStoragePath[]
) => {
  await Promise.all(
    uploads.map((upload) =>
      supabase.storage.from(upload.bucket).remove([upload.path]).catch(() => null)
    )
  );
};

export async function POST(request: Request) {
  const access = await getCurrentAccess();
  if (!access || access.role !== 'admin' || access.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: access ? 403 : 401 });
  }

  const body = await request.json().catch(() => null) as CreateBeatRequest | null;
  if (!body?.metadata) {
    return NextResponse.json({ error: 'Faltan los datos del beat.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const uploads = body.uploads ?? [];

  try {
    const metadata = normalizeBeatMetadata(body.metadata);
    const pathByField = new Map<UploadField, string>();

    for (const upload of uploads) {
      pathByField.set(upload.field, upload.path);
    }

    const { data: existing } = await supabase
      .from('beats')
      .select('id')
      .eq('slug', metadata.slug)
      .maybeSingle();

    if (existing) throw new Error(`Ya existe un beat con el slug "${metadata.slug}".`);

    const { error } = await supabase.from('beats').insert({
      slug: metadata.slug,
      title: metadata.title,
      bpm: metadata.bpm,
      key: metadata.key,
      genre: metadata.genre,
      producer_id: metadata.producer_id,
      tags: metadata.tags,
      cover_url: pathByField.get('cover') ?? null,
      preview_url: pathByField.get('preview') ?? null,
      price_basic: metadata.price_basic,
      price_premium: metadata.price_premium,
      price_exclusive: metadata.price_exclusive,
      file_basic_path: pathByField.get('basic') ?? null,
      file_premium_path: pathByField.get('premium') ?? null,
      file_exclusive_path: pathByField.get('exclusive') ?? null,
      status: 'available'
    });

    if (error) throw new Error(`No se pudo guardar el beat: ${error.message}`);

    return NextResponse.json({ ok: true, slug: metadata.slug });
  } catch (error) {
    await cleanupUploadedFiles(supabase, uploads);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo crear el beat.' },
      { status: 400 }
    );
  }
}
