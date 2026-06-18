'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBytes, MAX_FILE_BYTES, MAX_TOTAL_UPLOAD_BYTES, type UploadField } from '@/lib/beat-upload';

type LicenseUploadField = 'basic' | 'premium' | 'exclusive';

type BeatFilesUploadFormProps = {
  beatId: string;
  paths: Record<LicenseUploadField, string | null>;
};

type PreparedUpload = {
  field: UploadField;
  name: string;
  size: number;
  type: string;
  bucket: string;
  path: string;
  signedUrl: string;
};

type UploadedPath = {
  field: UploadField;
  bucket: string;
  path: string;
};

const licenseFields: LicenseUploadField[] = ['basic', 'premium', 'exclusive'];
const labels: Record<UploadField, string> = {
  cover: 'Carátula',
  preview: 'Preview',
  basic: 'Básica',
  premium: 'Premium',
  exclusive: 'Ilimitada'
};

const postJson = async <T,>(body: unknown): Promise<T> => {
  const response = await fetch('/api/beats/update-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? 'No se pudieron actualizar los archivos.');
  return data as T;
};

const uploadWithProgress = (upload: PreparedUpload, file: File, onProgress: (loaded: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const formData = new FormData();
    formData.append('cacheControl', '3600');
    formData.append('', file);

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload.signedUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onerror = () => reject(new Error(`No se pudo subir ${upload.name}.`));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(file.size);
        resolve();
      } else {
        reject(new Error(`Supabase rechazo ${upload.name} (${xhr.status}).`));
      }
    };
    xhr.send(formData);
  });

export function BeatFilesUploadForm({ beatId, paths }: BeatFilesUploadFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const isUploading = status === 'uploading';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isUploading) return;

    const formData = new FormData(event.currentTarget);
    const selected = licenseFields
      .map((field): { field: LicenseUploadField; file: File } | null => {
        const file = formData.get(field);
        return file instanceof File && file.size > 0 ? { field, file } : null;
      })
      .filter((item): item is { field: LicenseUploadField; file: File } => item !== null);

    if (!selected.length) {
      setStatus('error');
      setMessage('Selecciona al menos un archivo de licencia.');
      return;
    }

    const totalBytes = selected.reduce((sum, item) => sum + item.file.size, 0);
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      setStatus('error');
      setMessage(`La subida total pesa ${formatBytes(totalBytes)}. Maximo permitido: ${formatBytes(MAX_TOTAL_UPLOAD_BYTES)}.`);
      return;
    }

    for (const item of selected) {
      const maxBytes = MAX_FILE_BYTES[item.field];
      if (item.file.size > maxBytes) {
        setStatus('error');
        setMessage(`${labels[item.field]} pesa ${formatBytes(item.file.size)}. Maximo permitido: ${formatBytes(maxBytes)}.`);
        return;
      }
    }

    let completedBytes = 0;
    const uploaded: UploadedPath[] = [];

    try {
      setStatus('uploading');
      setProgress(2);
      setMessage('Preparando subida...');

      const prepared = await postJson<{ uploads: PreparedUpload[] }>({
        step: 'prepare',
        beat_id: beatId,
        files: selected.map((item) => ({
          field: item.field,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type
        }))
      });

      for (const upload of prepared.uploads) {
        const file = selected.find((item) => item.field === upload.field)?.file;
        if (!file) continue;
        setMessage(`Subiendo ${labels[upload.field]}...`);
        await uploadWithProgress(upload, file, (loaded) => {
          setProgress(Math.min(94, Math.round(((completedBytes + loaded) / totalBytes) * 92)));
        });
        completedBytes += file.size;
        uploaded.push({ field: upload.field, bucket: upload.bucket, path: upload.path });
      }

      setMessage('Guardando archivos...');
      setProgress(97);
      await postJson({ step: 'finalize', beat_id: beatId, uploads: uploaded });
      setStatus('success');
      setMessage('Archivos actualizados. Este beat ya puede vender las licencias cargadas.');
      setProgress(100);
      router.refresh();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No se pudieron actualizar los archivos.');
      setProgress(0);
    }
  };

  return (
    <div className="beat-files-box">
      <div className="beat-file-status-list">
        {licenseFields.map((field) => (
          <span key={field} className={paths[field] ? 'ready' : 'missing'}>
            {labels[field]}: {paths[field] ? 'archivo cargado' : 'falta archivo'}
          </span>
        ))}
      </div>
      <form className="grid beat-files-form" onSubmit={handleSubmit}>
        <label>
          <span className="field-label">Básica <em>audio</em></span>
          <input name="basic" type="file" accept="audio/*" disabled={isUploading} />
        </label>
        <label>
          <span className="field-label">Premium <em>audio</em></span>
          <input name="premium" type="file" accept="audio/*" disabled={isUploading} />
        </label>
        <label>
          <span className="field-label">Ilimitada <em>zip/rar</em></span>
          <input name="exclusive" type="file" accept=".zip,.rar,application/zip,application/x-zip-compressed" disabled={isUploading} />
        </label>
        <button className="primary span-2" disabled={isUploading} aria-busy={isUploading}>
          {isUploading ? 'Subiendo...' : 'Subir / reemplazar archivos'}
        </button>
      </form>
      {status !== 'idle' && (
        <div className={`beat-files-progress beat-files-progress-${status}`}>
          <span>{message}</span>
          <div><b style={{ width: `${progress}%` }} /></div>
          <strong>{progress}%</strong>
        </div>
      )}
    </div>
  );
}
