import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import type { BeatStoragePath } from '@/lib/beat-upload';

type CleanupRequest = {
  uploads?: BeatStoragePath[];
};

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as CleanupRequest | null;
  const uploads = body?.uploads ?? [];
  const supabase = createSupabaseAdminClient();

  await Promise.all(
    uploads.map((upload) =>
      supabase.storage.from(upload.bucket).remove([upload.path]).catch(() => null)
    )
  );

  return NextResponse.json({ ok: true });
}
