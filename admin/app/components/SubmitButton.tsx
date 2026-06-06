'use client';

import { useFormStatus } from 'react-dom';
import { useActionFormStatus } from './ActionForm';

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
};

export function SubmitButton({ children, pendingText = 'Procesando...', className, disabled = false }: SubmitButtonProps) {
  const nativeStatus = useFormStatus();
  const actionStatus = useActionFormStatus();
  const pending = nativeStatus.pending || actionStatus.pending;

  return (
    <button className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
