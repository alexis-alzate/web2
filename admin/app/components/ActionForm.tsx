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
};

type ActionFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> & {
  action: (formData: FormData) => Promise<unknown>;
  children: ReactNode;
  savingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  resetOnSuccess?: boolean;
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
  ...formProps
}: ActionFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (nextToast: ToastState, autoHide = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(nextToast);

    if (autoHide) {
      toastTimer.current = setTimeout(() => {
        setToast(null);
      }, 3800);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    showToast({
      type: 'loading',
      title: 'Publicando',
      message: savingMessage
    }, false);

    startTransition(async () => {
      try {
        await action(formData);
        if (resetOnSuccess) formRef.current?.reset();
        router.refresh();
        showToast({
          type: 'success',
          title: 'Listo',
          message: successMessage
        });
      } catch (error) {
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
