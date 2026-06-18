'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBytes, MAX_FILE_BYTES, MAX_TOTAL_UPLOAD_BYTES, type UploadField } from '@/lib/beat-upload';

type ProducerOption = {
  id: string;
  stage_name: string;
  platform_commission_percent: number;
  status: 'active' | 'inactive';
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

type UploadState = {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message: string;
  detail: string;
  progress: number;
  currentFile: string;
};

const initialState: UploadState = {
  status: 'idle',
  message: '',
  detail: '',
  progress: 0,
  currentFile: ''
};

const fileFieldLabels: Record<UploadField, string> = {
  cover: 'Carátula',
  preview: 'Preview de audio',
  basic: 'Archivo básica',
  premium: 'Archivo premium',
  exclusive: 'Archivo ilimitada'
};

const apiPost = async <T,>(url: string, body: unknown, stepLabel: string): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(`${stepLabel}: no se pudo conectar con el servidor del admin. Revisa la sesion, la conexion o el deploy.`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${stepLabel}: ${data?.error ?? 'no se pudo completar la accion.'}`);
  }

  return data as T;
};

const uploadSignedFile = (
  upload: PreparedUpload,
  file: File,
  onProgress: (loaded: number) => void,
  mode: 'signed-only' | 'sdk-headers'
) =>
  new Promise<void>((resolve, reject) => {
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const formData = new FormData();
    formData.append('cacheControl', '3600');
    formData.append('', file);

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload.signedUrl);

    if (mode === 'sdk-headers' && publishableKey) {
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.setRequestHeader('apikey', publishableKey);
      xhr.setRequestHeader('Authorization', `Bearer ${publishableKey}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };

    xhr.onerror = () => reject(new Error(`No se pudo subir ${upload.name}. El navegador bloqueo o corto la conexion con Supabase Storage.`));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(file.size);
        resolve();
        return;
      }
      reject(new Error(`Supabase rechazo ${upload.name} (${xhr.status}).`));
    };

    xhr.send(formData);
  });

const uploadFileWithProgress = async (
  upload: PreparedUpload,
  file: File,
  onProgress: (loaded: number) => void
) => {
  try {
    await uploadSignedFile(upload, file, onProgress, 'signed-only');
  } catch (firstError) {
    try {
      await uploadSignedFile(upload, file, onProgress, 'sdk-headers');
    } catch {
      throw firstError;
    }
  }
};

export function BeatUploadForm({ producers }: { producers: ProducerOption[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<UploadState>(initialState);
  const [completedBeatTitle, setCompletedBeatTitle] = useState('');
  const isUploading = state.status === 'uploading';

  const collectFile = (formData: FormData, field: UploadField) => {
    const file = formData.get(field);
    return file instanceof File && file.size > 0 ? file : null;
  };

  const validateFiles = (files: Record<UploadField, File | null>) => {
    const selected = Object.entries(files) as [UploadField, File | null][];
    const total = selected.reduce((sum, [, file]) => sum + (file?.size ?? 0), 0);

    if (total > MAX_TOTAL_UPLOAD_BYTES) {
      throw new Error(`La subida total pesa ${formatBytes(total)}. Maximo permitido: ${formatBytes(MAX_TOTAL_UPLOAD_BYTES)}.`);
    }

    for (const [field, file] of selected) {
      if (!file) continue;
      const maxBytes = MAX_FILE_BYTES[field];
      if (file.size > maxBytes) {
        throw new Error(`${fileFieldLabels[field]} pesa ${formatBytes(file.size)}. Maximo permitido: ${formatBytes(maxBytes)}.`);
      }
    }
  };

  const cleanupUploads = async (uploads: UploadedPath[]) => {
    if (!uploads.length) return;
    await fetch('/api/beats/cleanup-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploads })
    }).catch(() => null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isUploading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const metadata = {
      title: String(formData.get('title') ?? ''),
      bpm: String(formData.get('bpm') ?? ''),
      key: String(formData.get('key') ?? ''),
      genre: String(formData.get('genre') ?? ''),
      producer_id: String(formData.get('producer_id') ?? ''),
      tags: String(formData.get('tags') ?? ''),
      price_basic: String(formData.get('price_basic') ?? ''),
      price_premium: String(formData.get('price_premium') ?? ''),
      price_exclusive: String(formData.get('price_exclusive') ?? '')
    };

    const files: Record<UploadField, File | null> = {
      cover: collectFile(formData, 'cover'),
      preview: collectFile(formData, 'preview'),
      basic: collectFile(formData, 'basic'),
      premium: collectFile(formData, 'premium'),
      exclusive: collectFile(formData, 'exclusive')
    };

    const selectedFiles = (Object.entries(files) as [UploadField, File | null][])
      .filter((entry): entry is [UploadField, File] => entry[1] !== null);

    const totalBytes = selectedFiles.reduce((sum, [, file]) => sum + file.size, 0);
    let completedBytes = 0;
    const uploadedPaths: UploadedPath[] = [];

    try {
      validateFiles(files);
      setState({
        status: 'uploading',
        message: 'Preparando subida segura...',
        detail: selectedFiles.length ? `${selectedFiles.length} archivo(s), ${formatBytes(totalBytes)} aprox.` : 'Guardando beat sin archivos adjuntos.',
        progress: selectedFiles.length ? 2 : 45,
        currentFile: ''
      });

      const prepared = await apiPost<{ slug: string; uploads: PreparedUpload[] }>('/api/beats/upload-url', {
        metadata,
        files: selectedFiles.map(([field, file]) => ({
          field,
          name: file.name,
          size: file.size,
          type: file.type
        }))
      }, 'Preparando subida segura');

      for (const upload of prepared.uploads) {
        const file = files[upload.field];
        if (!file) continue;

        setState((current) => ({
          ...current,
          message: 'Subiendo archivos a Supabase...',
          detail: `${upload.name} · ${formatBytes(file.size)}`,
          currentFile: upload.name
        }));

        await uploadFileWithProgress(upload, file, (loaded) => {
          const progress = totalBytes > 0
            ? Math.min(92, Math.round(((completedBytes + loaded) / totalBytes) * 90))
            : 92;

          setState((current) => ({
            ...current,
            progress,
            detail: `${formatBytes(completedBytes + loaded)} / ${formatBytes(totalBytes)}`
          }));
        });

        completedBytes += file.size;
        uploadedPaths.push({ field: upload.field, bucket: upload.bucket, path: upload.path });
      }

      setState((current) => ({
        ...current,
        message: 'Guardando beat en Supabase...',
        detail: 'Finalizando publicacion.',
        progress: 96,
        currentFile: ''
      }));

      await apiPost('/api/beats/create', { metadata, uploads: uploadedPaths }, 'Guardando beat en Supabase');

      setCompletedBeatTitle(metadata.title.trim());
      setState({
        status: 'success',
        message: 'Beat publicado en la tienda.',
        detail: 'Archivos subidos y registro creado correctamente.',
        progress: 100,
        currentFile: ''
      });
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      await cleanupUploads(uploadedPaths);
      setState({
        status: 'error',
        message: 'No se pudo publicar el beat.',
        detail: error instanceof Error ? error.message : 'Error desconocido.',
        progress: 0,
        currentFile: ''
      });
    }
  };

  return (
    <form ref={formRef} className="grid beat-upload-form" onSubmit={handleSubmit}>
      <div className="span-2 beat-form-note">
        <strong>Campos obligatorios</strong>
        <span>Título y los 3 precios. Los archivos son opcionales para guardar el beat, pero necesarios para vender cada licencia. Sube máximo 240 MB por publicación.</span>
      </div>

      <label className="span-2">
        <span className="field-label">Título <em>obligatorio</em></span>
        <input name="title" required placeholder="Nombre del beat" disabled={isUploading} />
      </label>
      <label>
        <span className="field-label">BPM <em>opcional</em></span>
        <input name="bpm" type="number" placeholder="88" disabled={isUploading} />
      </label>
      <label>
        <span className="field-label">Tonalidad <em>opcional</em></span>
        <input name="key" placeholder="C minor" disabled={isUploading} />
      </label>
      <label>
        <span className="field-label">Género <em>opcional</em></span>
        <input name="genre" placeholder="Afrobeat" disabled={isUploading} />
      </label>
      <label>
        <span className="field-label">Productor <em>opcional</em></span>
        <select name="producer_id" defaultValue="" disabled={isUploading}>
          <option value="">Sin productor asignado</option>
          {producers
            .filter((producer) => producer.status === 'active')
            .map((producer) => (
              <option key={producer.id} value={producer.id}>
                {producer.stage_name} — LUJO URBAN {producer.platform_commission_percent}%
              </option>
            ))}
        </select>
        <small className="muted">Si lo asignas, recibira notificacion cuando se venda el beat.</small>
      </label>
      <label>
        <span className="field-label">Tags <em>opcional</em></span>
        <input name="tags" placeholder="afro dancehall, type beat" disabled={isUploading} />
        <small className="muted">Separados por coma.</small>
      </label>
      <label>
        <span className="field-label">Precio básica (COP) <em>obligatorio</em></span>
        <input name="price_basic" type="number" required placeholder="100000" disabled={isUploading} />
      </label>
      <label>
        <span className="field-label">Precio premium (COP) <em>obligatorio</em></span>
        <input name="price_premium" type="number" required placeholder="200000" disabled={isUploading} />
      </label>
      <label>
        <span className="field-label">Precio ilimitada (COP) <em>obligatorio</em></span>
        <input name="price_exclusive" type="number" required placeholder="400000" disabled={isUploading} />
      </label>
      <label className="span-2">
        <span className="field-label">Carátula <em>opcional</em></span>
        <input name="cover" type="file" accept="image/*" disabled={isUploading} />
        <small className="muted">Se guarda en Supabase Storage: beats-covers.</small>
      </label>
      <label className="span-2">
        <span className="field-label">Preview de audio <em>opcional</em></span>
        <input name="preview" type="file" accept="audio/*" disabled={isUploading} />
        <small className="muted">Se guarda en beats-previews y alimenta el reproductor.</small>
      </label>
      <label>
        <span className="field-label">Archivo básica <em>opcional</em></span>
        <input name="basic" type="file" accept="audio/*" disabled={isUploading} />
        <small className="muted">Necesario para vender la licencia básica.</small>
      </label>
      <label>
        <span className="field-label">Archivo premium <em>opcional</em></span>
        <input name="premium" type="file" accept="audio/*" disabled={isUploading} />
        <small className="muted">Necesario para vender la licencia premium.</small>
      </label>
      <label>
        <span className="field-label">Archivo ilimitada <em>opcional</em></span>
        <input name="exclusive" type="file" accept=".zip,.rar,application/zip,application/x-zip-compressed" disabled={isUploading} />
        <small className="muted">ZIP/RAR con stems. Necesario para vender ilimitada.</small>
      </label>

      {state.status !== 'idle' && (
        <div className={`span-2 beat-upload-progress beat-upload-progress-${state.status}`} role="status" aria-live="polite">
          <div>
            <strong>{state.message}</strong>
            <span>{state.detail}</span>
            {state.currentFile && <small>{state.currentFile}</small>}
          </div>
          <div className="beat-upload-progress-track">
            <span style={{ width: `${state.progress}%` }} />
          </div>
          <b>{state.progress}%</b>
        </div>
      )}

      <button className="primary span-2" disabled={isUploading} aria-busy={isUploading}>
        {isUploading ? 'Publicando...' : 'Publicar beat'}
      </button>

      {state.status === 'success' && completedBeatTitle && (
        <div className="beat-upload-complete-backdrop" role="presentation">
          <div className="beat-upload-complete" role="dialog" aria-modal="true" aria-labelledby="beat-upload-complete-title">
            <span className="beat-upload-complete-orb" aria-hidden="true">✓</span>
            <p className="eyebrow">Publicación completada</p>
            <h3 id="beat-upload-complete-title">{completedBeatTitle}</h3>
            <p>El beat quedó guardado en Supabase y ya aparece en la tienda.</p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setCompletedBeatTitle('');
                setState(initialState);
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
