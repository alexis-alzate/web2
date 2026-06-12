import { NextResponse } from 'next/server';

const getSupabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL.');
  return value.replace(/\/$/, '');
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const cleanPath = path.filter(Boolean).map(encodeURIComponent).join('/');

  if (!cleanPath) {
    return NextResponse.json({ error: 'Preview inválido.' }, { status: 400 });
  }

  const range = request.headers.get('range');
  const previewUrl = `${getSupabaseUrl()}/storage/v1/object/public/beats-previews/${cleanPath}`;
  const upstream = await fetch(previewUrl, {
    headers: range ? { range } : undefined,
    cache: 'no-store'
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Preview no disponible.' }, { status: upstream.status || 404 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  const acceptRanges = upstream.headers.get('accept-ranges');

  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
  headers.set('cross-origin-resource-policy', 'same-origin');
  if (contentLength) headers.set('content-length', contentLength);
  if (contentRange) headers.set('content-range', contentRange);
  if (acceptRanges) headers.set('accept-ranges', acceptRanges);

  return new Response(upstream.body, {
    status: upstream.status,
    headers
  });
}
