'use client';
import { useActionState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { enrollMfa, verifyMfa, type MfaState } from '@/modules/auth/mfa';
import { SubmitButton } from './submit-button';
const initial: MfaState = { message: '' };
export function MfaSetup({ existing, returnTo = '/rh' }: { existing?: string; returnTo?: string }) {
  const [enrollment, enroll, pendingEnroll] = useActionState(enrollMfa, initial);
  const [verification, verify, pendingVerify] = useActionState(verifyMfa, initial);
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  useEffect(() => {
    if (verification.done) {
      startNavigation(() => {
        router.push(returnTo);
        router.refresh();
      });
    }
  }, [verification.done, router, returnTo]);
  const factorId = enrollment.factorId || existing;
  return (
    <div className="card">
      <h2>Aplicativo autenticador</h2>
      <p className="muted">
        Proteja sua conta com um segundo fator. Use um aplicativo de autenticação compatível com
        TOTP.
      </p>
      {!factorId && (
        <form action={enroll}>
          <SubmitButton className="button primary" busy={pendingEnroll} pendingLabel="Preparando…">
            Configurar autenticador
          </SubmitButton>
        </form>
      )}
      {enrollment.qr && (
        <div>
          <p>Escaneie o código:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr" src={enrollment.qr} alt="QR code para cadastrar o autenticador" />
          <p className="muted">
            Chave manual: <code>{enrollment.secret}</code>
          </p>
        </div>
      )}
      {factorId && (
        <form action={verify} className="form">
          <input type="hidden" name="factor_id" value={factorId} />
          <label className="field">
            <span>Código de seis dígitos</span>
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
            />
          </label>
          <SubmitButton
            className="button primary"
            busy={pendingVerify || navigating}
            pendingLabel={navigating ? 'Abrindo página…' : 'Verificando…'}
          >
            Confirmar código
          </SubmitButton>
        </form>
      )}
      {(enrollment.message || verification.message) && (
        <p role="status" className="alert info">
          {verification.message || enrollment.message}
        </p>
      )}
    </div>
  );
}
