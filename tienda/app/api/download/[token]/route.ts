import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { filePathForLicense, type Beat, type LicenseType } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: download, error } = await supabase
    .from('downloads')
    .select('*, order_items(license_type, beats(*))')
    .eq('token', token)
    .single();

  if (error || !download) {
    return NextResponse.json({ error: 'Enlace de descarga inválido.' }, { status: 404 });
  }

  if (new Date(download.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Este enlace de descarga expiró.' }, { status: 410 });
  }

  if (download.download_count >= download.max_downloads) {
    return NextResponse.json({ error: 'Alcanzaste el límite de descargas para este enlace.' }, { status: 410 });
  }

  const orderItem = download.order_items as { license_type: LicenseType; beats: Beat };
  const filePath = filePathForLicense(orderItem.beats, orderItem.license_type);

  if (!filePath) {
    return NextResponse.json({ error: 'El archivo de este beat no está disponible.' }, { status: 404 });
  }

  const downloadName = `${orderItem.beats.title} - Licencia ${orderItem.license_type}${filePath.match(/\.[^.]+$/)?.[0] ?? ''}`;

  const { data: signed, error: signedError } = await supabase.storage
    .from('beats-files')
    .createSignedUrl(filePath, 60, { download: downloadName });

  if (signedError || !signed) {
    return NextResponse.json({ error: 'No se pudo generar el enlace de descarga.' }, { status: 500 });
  }

  await supabase
    .from('downloads')
    .update({ download_count: download.download_count + 1, used_at: new Date().toISOString() })
    .eq('id', download.id);

  return NextResponse.redirect(signed.signedUrl);
}
