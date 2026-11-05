'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ShareCategory } from '@fg/shared';
import { api, isGrantActive } from '@/lib/api';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { ErrorText, Status, useErrorMessage } from './ui';

/** Lets the senior pick people who hold an active grant for `category` and share one item with them. */
export function SharePanel({
  category,
  title,
  noneKey,
  onShare,
}: {
  category: ShareCategory;
  title: MessageKey;
  noneKey: MessageKey;
  onShare: (userIds: string[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .grants()
      .then((gs) => {
        const map = new Map<string, string>();
        for (const g of gs) if (g.category === category && isGrantActive(g)) map.set(g.granteeUserId, g.granteeName);
        setPeople([...map].map(([id, name]) => ({ id, name })));
      })
      .catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function send() {
    setError('');
    if (picked.length === 0) {
      setError(t('scam.sharePick'));
      return;
    }
    setBusy(true);
    try {
      await onShare(picked);
      const names = (people ?? []).filter((p) => picked.includes(p.id)).map((p) => p.name);
      setDone(t('scam.shareDone', { names: names.join(', ') }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby={`share-${category}`}>
      <h3 id={`share-${category}`}>{t(title)}</h3>
      {!people && !error && <p>{t('common.loading')}</p>}
      {people && people.length === 0 && (
        <p>
          {t(noneKey)} <Link href="/privacy">{t('nav.privacy')}</Link>
        </p>
      )}
      {people && people.length > 0 && !done && (
        <fieldset aria-describedby={error ? `share-err-${category}` : undefined}>
          <legend>{t('scam.shareChoose')}</legend>
          {people.map((p) => (
            <label key={p.id} className="check">
              <input
                type="checkbox"
                checked={picked.includes(p.id)}
                onChange={(e) => setPicked((xs) => (e.target.checked ? [...xs, p.id] : xs.filter((x) => x !== p.id)))}
              />
              <span>{p.name}</span>
            </label>
          ))}
          <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
            {t('scam.shareSend')}
          </button>
        </fieldset>
      )}
      <ErrorText id={`share-err-${category}`}>{error}</ErrorText>
      <Status>{done}</Status>
    </section>
  );
}
