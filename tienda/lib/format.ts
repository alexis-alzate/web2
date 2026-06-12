export const formatCOP = (value: number) => '$' + Number(value).toLocaleString('es-CO');

export const formatTime = (seconds: number) => {
  if (!isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const publicUrl = (bucket: string, path: string | null) => {
  if (!path) return '';
  if (bucket === 'beats-previews') {
    return `/api/preview/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
};
