'use client';
import { useFormStatus } from 'react-dom';
import type { ComponentProps } from 'react';
import { Spinner } from './pending-feedback';

export function SubmitButton({
  children,
  pendingLabel = 'Processando…',
  busy = false,
  disabled,
  ...props
}: ComponentProps<'button'> & { pendingLabel?: string; busy?: boolean }) {
  const { pending } = useFormStatus();
  const waiting = pending || busy;
  return (
    <button {...props} type="submit" disabled={disabled || waiting} aria-busy={waiting}>
      {waiting ? (
        <>
          <Spinner />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
