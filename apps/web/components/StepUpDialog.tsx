'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { ErrorText, useErrorMessage } from './ui';

/** Asks the senior to re-enter her password (contract [step-up]). `action` receives the password. */
export function StepUpDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  action,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
  action: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const ref = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setPassword('');
      setError('');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError(t('stepup.required'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await action(password);
      setPassword('');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setError(t('stepup.wrong'));
      else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="stepup-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={onSubmit} noValidate>
        <h2 id="stepup-title">{title}</h2>
        {body && <p>{body}</p>}
        <p className="muted small">{t('stepup.body')}</p>
        <div className="field">
          <label htmlFor="stepup-password">{t('stepup.password')}</label>
          <input
            id="stepup-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'stepup-err' : undefined}
            autoFocus
          />
          <div role="alert"><ErrorText id="stepup-err">{error}</ErrorText></div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
