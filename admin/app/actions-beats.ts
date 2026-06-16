'use server';

import { isAuthenticated } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { slugify } from '@/lib/beats';

const requireAuth = async () => {
  if (!(await isAuthenticated())) throw new Error('No autorizado.');
};

const MB = 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 240 * MB;
const MAX_FILE_BYTES = {
  cover: 12 * MB,
  preview: 60 * MB,
  basic: 80 * MB,
  premium: 180 * MB,
  exclusive: 220 * MB
};

type UploadedFile = {
  bucket: string;
  path: string;
};

const formatBytes = (value: number) => `${Math.round(value / MB)} MB`;

const selectedFile = (formData: FormData, field: string) => {
  const file = formData.get(field);
  return file instanceof File && file.size > 0 ? file : null;
};

const validateFileSize = (file: File | null, label: string, maxBytes: number) => {
  if (!file || file.size <= maxBytes) return;
  throw new Error(`${label} pesa ${formatBytes(file.size)}. Maximo permitido: ${formatBytes(maxBytes)}.`);
};

const cleanupUploadedFiles = async (
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  uploadedFiles: UploadedFile[]
) => {
  await Promise.all(
    uploadedFiles.map(({ bucket, path }) =>
      supabase.storage.from(bucket).remove([path]).catch(() => null)
    )
  );
};

const numberField = (formData: FormData, field: string) => {
  const raw = formData.get(field);
  const value = Number(raw);
  if (!raw || Number.isNaN(value)) throw new Error(`El campo ${field} es invalido.`);
  return value;
};

const optionalText = (formData: FormData, field: string) => {
  const raw = formData.get(field);
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
};

const uploadFile = async (
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  path: string,
  file: File
) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (error) throw new Error(`No se pudo subir ${path}: ${error.message}`);
  return path;
};

const fileExt = (file: File, fallback: string) => {
  const match = file.name.match(/\.[^.]+$/);
  return match ? match[0] : fallback;
};

export const createBeatAction = async (formData: FormData) => {
  await requireAuth();
  const supabase = createSupabaseAdminClient();

  const title = (formData.get('title') as string)?.trim();
  if (!title) throw new Error('El titulo es obligatorio.');

  const slugInput = (formData.get('slug') as string)?.trim();
  const slug = slugify(slugInput || title);
  if (!slug) throw new Error('No se pudo generar un slug valido.');

  const { data: existing } = await supabase
    .from('beats')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) throw new Error(`Ya existe un beat con el slug "${slug}".`);

  const bpm = optionalText(formData, 'bpm') ? numberField(formData, 'bpm') : null;
  const key = optionalText(formData, 'key');
  const genre = optionalText(formData, 'genre');
  const tagsRaw = optionalText(formData, 'tags');
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : null;

  const priceBasic = numberField(formData, 'price_basic');
  const pricePremium = numberField(formData, 'price_premium');
  const priceExclusive = numberField(formData, 'price_exclusive');

  const coverFile = selectedFile(formData, 'cover');
  const previewFile = selectedFile(formData, 'preview');
  const basicFile = selectedFile(formData, 'file_basic');
  const premiumFile = selectedFile(formData, 'file_premium');
  const exclusiveFile = selectedFile(formData, 'file_exclusive');
  const uploadTotal = [coverFile, previewFile, basicFile, premiumFile, exclusiveFile]
    .reduce((sum, file) => sum + (file?.size ?? 0), 0);

  if (uploadTotal > MAX_TOTAL_UPLOAD_BYTES) {
    throw new Error(`La subida total pesa ${formatBytes(uploadTotal)}. Maximo permitido por publicacion: ${formatBytes(MAX_TOTAL_UPLOAD_BYTES)}.`);
  }

  validateFileSize(coverFile, 'La caratula', MAX_FILE_BYTES.cover);
  validateFileSize(previewFile, 'El preview', MAX_FILE_BYTES.preview);
  validateFileSize(basicFile, 'El archivo de licencia basica', MAX_FILE_BYTES.basic);
  validateFileSize(premiumFile, 'El archivo de licencia premium', MAX_FILE_BYTES.premium);
  validateFileSize(exclusiveFile, 'El archivo de licencia ilimitada', MAX_FILE_BYTES.exclusive);

  const uploadedFiles: UploadedFile[] = [];

  let coverPath: string | null = null;
  let previewPath: string | null = null;
  const licensePaths: Record<'basic' | 'premium' | 'exclusive', string | null> = {
    basic: null,
    premium: null,
    exclusive: null
  };

  try {
    if (coverFile) {
      coverPath = await uploadFile(supabase, 'beats-covers', `${slug}${fileExt(coverFile, '.jpg')}`, coverFile);
      uploadedFiles.push({ bucket: 'beats-covers', path: coverPath });
    }

    if (previewFile) {
      previewPath = await uploadFile(supabase, 'beats-previews', `${slug}-preview${fileExt(previewFile, '.mp3')}`, previewFile);
      uploadedFiles.push({ bucket: 'beats-previews', path: previewPath });
    }

    const licenseFiles = {
      basic: basicFile,
      premium: premiumFile,
      exclusive: exclusiveFile
    };

    for (const license of ['basic', 'premium', 'exclusive'] as const) {
      const file = licenseFiles[license];
      if (file) {
        licensePaths[license] = await uploadFile(
          supabase,
          'beats-files',
          `${slug}-${license}${fileExt(file, '.zip')}`,
          file
        );
        uploadedFiles.push({ bucket: 'beats-files', path: licensePaths[license]! });
      }
    }

    const { error } = await supabase.from('beats').insert({
      slug,
      title,
      bpm,
      key,
      genre,
      tags,
      cover_url: coverPath,
      preview_url: previewPath,
      price_basic: priceBasic,
      price_premium: pricePremium,
      price_exclusive: priceExclusive,
      file_basic_path: licensePaths.basic,
      file_premium_path: licensePaths.premium,
      file_exclusive_path: licensePaths.exclusive,
      status: 'available'
    });

    if (error) throw new Error(`No se pudo guardar el beat: ${error.message}`);
  } catch (error) {
    await cleanupUploadedFiles(supabase, uploadedFiles);
    throw error;
  }
};

export const deleteBeatAction = async (formData: FormData) => {
  await requireAuth();
  const supabase = createSupabaseAdminClient();

  const id = formData.get('id') as string;
  if (!id) throw new Error('Falta el id del beat.');

  const { error } = await supabase.from('beats').delete().eq('id', id);
  if (error) throw new Error(`No se pudo eliminar el beat: ${error.message}`);
};

export const toggleDemoBeatsAction = async (formData: FormData) => {
  await requireAuth();
  const supabase = createSupabaseAdminClient();

  const current = formData.get('current') as string;
  const nextValue = current !== 'true';

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'show_demo_beats', value: nextValue });
  if (error) throw new Error(`No se pudo actualizar la configuracion: ${error.message}`);
};

export const toggleBeatStatusAction = async (formData: FormData) => {
  await requireAuth();
  const supabase = createSupabaseAdminClient();

  const id = formData.get('id') as string;
  const currentStatus = formData.get('status') as string;
  if (!id) throw new Error('Falta el id del beat.');

  const nextStatus = currentStatus === 'available' ? 'sold_exclusive' : 'available';

  const { error } = await supabase.from('beats').update({ status: nextStatus }).eq('id', id);
  if (error) throw new Error(`No se pudo actualizar el estado: ${error.message}`);
};
