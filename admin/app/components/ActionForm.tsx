'use client';

import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react';
import type { FormEvent, FormHTMLAttributes, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type ActionFormStatus = {
  pending: boolean;
};

type ToastState = {
  type: 'loading' | 'success' | 'error';
  title: string;
  message: string;
  progress?: number;
  progressLabel?: string;
};

type ActionFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> & {
  action: (formData: FormData) => Promise<unknown>;
  children: ReactNode;
  savingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  resetOnSuccess?: boolean;
  showProgress?: boolean;
};

const ActionFormContext = createContext<ActionFormStatus>({ pending: false });

export const useActionFormStatus = () => useContext(ActionFormContext);

export function ActionForm({
  action,
  children,
  className,
  savingMessage = 'Guardando cambios...',
  successMessage = 'Cambios publicados correctamente.',
  errorMessage = 'No se pudo completar la accion.',
  resetOnSuccess = false,
  showProgress = false,
  ...formProps
}: ActionFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (progressTimer.current) clearInterval(progressTimer.current);
  }, []);

  const stopProgress = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const showToast = (nextToast: ToastState, autoHide = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(nextToast);

    if (autoHide) {
      toastTimer.current = setTimeout(() => {
        setToast(null);
      }, 3800);
    }
  };

  const selectedUploadSummary = (formData: FormData) => {
    const files = Array.from(formData.values()).filter((value): value is File =>
      value instanceof File && value.size > 0
    );
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const totalMb = totalBytes / (1024 * 1024);

    if (!files.length) return 'Guardando datos en Supabase...';
    return `Subiendo ${files.length} archivo(s), ${totalMb.toFixed(totalMb >= 10 ? 0 : 1)} MB aprox.`;
  };

  const startProgress = (formData: FormData) => {
    if (!showProgress) return;
    stopProgress();

    const progressLabel = selectedUploadSummary(formData);
    setToast((current) => current ? { ...current, progress: 8, progressLabel } : current);

    progressTimer.current = setInterval(() => {
      setToast((current) => {
        if (!current || current.type !== 'loading') return current;
        const currentValue = current.progress ?? 8;
        const nextValue = currentValue < 55
          ? currentValue + 7
          : currentValue < 82
            ? currentValue + 3
            : Math.min(currentValue + 1, 94);

        return {
          ...current,
          progress: Math.min(nextValue, 94),
          progressLabel
        };
      });
    }, 650);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    showToast({
      type: 'loading',
      title: 'Publicando',
      message: savingMessage,
      progress: showProgress ? 4 : undefined,
      progressLabel: showProgress ? selectedUploadSummary(formData) : undefined
    }, false);
    startProgress(formData);

    startTransition(async () => {
      try {
        await action(formData);
        stopProgress();
        if (showProgress) {
          setToast((current) => current ? { ...current, progress: 100, progressLabel: 'Publicacion completada.' } : current);
        }
        if (resetOnSuccess) formRef.current?.reset();
        router.refresh();
        showToast({
          type: 'success',
          title: 'Listo',
          message: successMessage,
          progress: showProgress ? 100 : undefined,
          progressLabel: showProgress ? 'Publicacion completada.' : undefined
        });
      } catch (error) {
        stopProgress();
        showToast({
          type: 'error',
          title: 'Revision necesaria',
          message: error instanceof Error ? error.message : errorMessage
        }, false);
      }
    });
  };

  return (
    <ActionFormContext.Provider value={{ pending }}>
      <form ref={formRef} className={className} onSubmit={handleSubmit} {...formProps}>
        {children}
      </form>
      {toast ? (
        <div className={`admin-toast admin-toast-${toast.type}`} role="status" aria-live="polite">
          <span className="admin-toast-orb" aria-hidden="true" />
          <span>
            <strong>{toast.title}</strong>
            <small>{toast.message}</small>
            {typeof toast.progress === 'number' ? (
              <span className="admin-toast-progress" aria-label={`Progreso ${Math.round(toast.progress)}%`}>
                <span className="admin-toast-progress-track">
                  <span className="admin-toast-progress-fill" style={{ width: `${toast.progress}%` }} />
                </span>
                <span className="admin-toast-progress-text">
                  <span>{toast.progressLabel}</span>
                  <b>{Math.round(toast.progress)}%</b>
                </span>
              </span>
            ) : null}
          </span>
          {toast.type === 'error' ? (
            <button type="button" className="admin-toast-close" onClick={() => setToast(null)} aria-label="Cerrar notificacion">
              x
            </button>
          ) : null}
        </div>
      ) : null}
    </ActionFormContext.Provider>
  );
}
