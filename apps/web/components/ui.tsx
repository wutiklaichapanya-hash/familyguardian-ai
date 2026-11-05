'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Role } from '@fg/shared';
import { ApiError } from '@/lib/api';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { homePathFor, useSession } from '@/lib/session';

/** Polite live region. Always rendered so screen readers pick up later changes. */
export function Status({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`status ${className}`}>
      {children}
    </div>
  );
}

export function ErrorText({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="field-error">
      <span aria-hidden="true">⚠ </span>
      {children}
    </p>
  );
}

export function useErrorMessage() {
  const { t } = useI18n();
  return (e: unknown, overrides: Partial<Record<number, MessageKey>> = {}): string => {
    if (e instanceof ApiError) {
      const k = overrides[e.status];
      if (k) return t(k);
      if (e.status === 0) return t('common.networkError');
      if (e.status === 403) return t('common.forbidden');
    }
    return t('common.error');
  };
}

export function Chip({ tone = 'neutral', icon, children }: { tone?: 'neutral' | 'ok' | 'warm' | 'alert' | 'brand'; icon?: string; children: ReactNode }) {
  return (
    <span className={`chip chip-${tone}`}>
      {icon && <span aria-hidden="true">{icon} </span>}
      {children}
    </span>
  );
}

export function BackHome() {
  const { t } = useI18n();
  const { me } = useSession();
  return (
    <p className="back-link">
      <Link href={me ? homePathFor(me.user.role) : '/'}>
        <span aria-hidden="true">← </span>
        {t('nav.back')}
      </Link>
    </p>
  );
}

/** Gate a page by role. The API is the real authority; this only picks the right UI. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { t } = useI18n();
  const { status, me } = useSession();
  if (status === 'loading') return <Status>{t('common.loading')}</Status>;
  if (status === 'error')
    return (
      <div className="card">
        <h1>{t('app.name')}</h1>
        <p>{t('common.networkError')}</p>
      </div>
    );
  if (!me)
    return (
      <div className="card">
        <h1>{t('common.signInRequired')}</h1>
        <p>
          <Link className="btn btn-primary" href="/login">
            {t('common.goLogin')}
          </Link>
        </p>
      </div>
    );
  if (!roles.includes(me.user.role))
    return (
      <div className="card">
        <h1>{t('common.wrongRole')}</h1>
        <p>
          <Link className="btn btn-primary" href={homePathFor(me.user.role)}>
            {t('common.goHome')}
          </Link>
        </p>
      </div>
    );
  return <>{children}</>;
}

/** Native modal dialog: focus is trapped and restored by the browser; Esc cancels. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-title"
      aria-describedby={body ? 'confirm-body' : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      {body && <p id="confirm-body">{body}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>
          {t('common.cancel')}
        </button>
        <button type="button" className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function TelLink({ phone, children, onCall, className = 'btn btn-secondary btn-block' }: { phone: string; children: ReactNode; onCall?: () => void; className?: string }) {
  const href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  return (
    <a href={href} className={className} onClick={onCall}>
      <span aria-hidden="true">📞 </span>
      {children}
    </a>
  );
}
