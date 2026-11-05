'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ContactDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { AlertRegion, BackHome, ConfirmDialog, ErrorSummary, ErrorText, LoadError, RequireRole, Status, TelLink, useErrorMessage } from '@/components/ui';

const PHONE_RE = /^\+?[\d\s-]{9,15}$/;

function ContactsInner() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [contacts, setContacts] = useState<ContactDTO[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');
  const [isCall, setIsCall] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldErr, setFieldErr] = useState<{ name?: string; relationship?: string; phone?: string }>({});
  const [formError, setFormError] = useState('');
  const [toRemove, setToRemove] = useState<ContactDTO | null>(null);

  const load = useCallback(async () => {
    try {
      setContacts(await api.contacts());
      setLoadError('');
    } catch (e) {
      setLoadError(errMsg(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function onCall(c: ContactDTO) {
    // Do not block the dialler; log in the background. The app cannot know whether the call went through.
    setIsCall(true);
    setStatus(t('contacts.started', { name: c.name, time: formatTime(new Date().toISOString(), locale) }));
    void api.logCall({ contactId: c.id }).catch(() => undefined);
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErr = {};
    if (!name.trim()) errs.name = t('contacts.fieldRequired');
    if (!relationship.trim()) errs.relationship = t('contacts.fieldRequired');
    const digits = phone.replace(/\D/g, '');
    if (!PHONE_RE.test(phone.trim()) || digits.length < 9 || digits.length > 10) errs.phone = t('contacts.phoneInvalid');
    setFieldErr(errs);
    setFormError('');
    if (Object.keys(errs).length) {
      // Move focus to the first invalid field (WCAG 3.3.1); the summary announces all of them.
      document.getElementById(errs.name ? 'c-name' : errs.relationship ? 'c-rel' : 'c-phone')?.focus();
      return;
    }
    try {
      const c = await api.createContact({ name: name.trim(), relationship: relationship.trim(), phone: phone.trim() });
      setContacts((cs) => [...(cs ?? []), c]);
      setIsCall(false);
      setStatus(t('contacts.added', { name: c.name }));
      setName('');
      setRelationship('');
      setPhone('');
    } catch (err) {
      setFormError(errMsg(err));
    }
  }

  async function confirmRemove() {
    const c = toRemove;
    setToRemove(null);
    if (!c) return;
    try {
      await api.deleteContact(c.id);
      setContacts((cs) => (cs ?? []).filter((x) => x.id !== c.id));
      setIsCall(false);
      setStatus(t('contacts.removed', { name: c.name }));
    } catch (err) {
      setIsCall(false);
      setStatus(errMsg(err));
    }
  }

  return (
    <>
      <BackHome />
      <h1>{t('contacts.title')}</h1>
      <p className="muted">{t('contacts.hint')}</p>
      <Status className="notice">{status && (
        <>
          <strong>{status}</strong>
          <br />
          {isCall && <span className="small">{t('contacts.startedNote')}</span>}
        </>
      )}</Status>
      <LoadError message={loadError} onRetry={() => void load()} />
      {!contacts && !loadError && <p>{t('common.loading')}</p>}
      {contacts && contacts.length === 0 && <p>{t('contacts.empty')}</p>}
      {contacts && contacts.length > 0 && (
        <ul className="list-plain">
          {contacts.map((c) => (
            <li key={c.id} className="stack">
              <TelLink phone={c.phone} onCall={() => onCall(c)} className="btn btn-primary btn-block">
                <span className="call-label">
                  {t('contacts.callBtn', { name: c.name, relationship: c.relationship })}
                  <span className="small call-number">{c.phone}</span>
                </span>
              </TelLink>
              <div className="row">
                <button type="button" className="link-button" onClick={() => setToRemove(c)}>
                  {t('contacts.remove', { name: c.name })}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="add-h" className="card">
        <h2 id="add-h">{t('contacts.addTitle')}</h2>
        <form onSubmit={onAdd} noValidate>
          <ErrorSummary
            errors={[
              ...(fieldErr.name ? [{ fieldId: 'c-name', label: t('contacts.name'), message: fieldErr.name }] : []),
              ...(fieldErr.relationship ? [{ fieldId: 'c-rel', label: t('contacts.relationship'), message: fieldErr.relationship }] : []),
              ...(fieldErr.phone ? [{ fieldId: 'c-phone', label: t('contacts.phone'), message: fieldErr.phone }] : []),
            ]}
          />
          <div className="field">
            <label htmlFor="c-name">{t('contacts.name')}</label>
            <input id="c-name" type="text" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErr.name || undefined} aria-describedby={fieldErr.name ? 'c-name-err' : undefined} />
            <ErrorText id="c-name-err">{fieldErr.name}</ErrorText>
          </div>
          <div className="field">
            <label htmlFor="c-rel">{t('contacts.relationship')}</label>
            <input id="c-rel" type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)} aria-invalid={!!fieldErr.relationship || undefined} aria-describedby={fieldErr.relationship ? 'c-rel-err' : undefined} />
            <ErrorText id="c-rel-err">{fieldErr.relationship}</ErrorText>
          </div>
          <div className="field">
            <label htmlFor="c-phone">{t('contacts.phone')}</label>
            <span id="c-phone-hint" className="hint">{t('contacts.phoneHint')}</span>
            <input id="c-phone" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!fieldErr.phone || undefined} aria-describedby={`c-phone-hint${fieldErr.phone ? ' c-phone-err' : ''}`} />
            <ErrorText id="c-phone-err">{fieldErr.phone}</ErrorText>
          </div>
          <AlertRegion>{formError}</AlertRegion>
          <button type="submit" className="btn btn-secondary btn-block">{t('contacts.add')}</button>
        </form>
      </section>

      <ConfirmDialog
        open={!!toRemove}
        title={toRemove ? t('contacts.removeConfirm', { name: toRemove.name }) : ''}
        confirmLabel={toRemove ? t('contacts.remove', { name: toRemove.name }) : ''}
        danger
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}

export default function ContactsPage() {
  return (
    <RequireRole roles={['senior']}>
      <ContactsInner />
    </RequireRole>
  );
}
