'use client';

import type { DeliveryDTO } from '@fg/shared';
import { formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { STATE_VISUAL } from '@/lib/visual';
import { Chip } from './ui';

/** Honest delivery states. Simulated channels are labelled as such. */
export function DeliveryList({ deliveries }: { deliveries: DeliveryDTO[] }) {
  const { t, locale } = useI18n();
  return (
    <ul className="list-plain">
      {deliveries.map((d) => {
        const v = STATE_VISUAL[d.state];
        const simulated = d.channel !== 'in_app';
        return (
          <li key={d.notificationId}>
            <div className="row">
              <span>{t(`state.${d.state}`, { name: d.recipientName })}</span>
              <Chip tone={v.tone} icon={v.icon}>{t(`chip.${d.state}`)}</Chip>
            </div>
            <span className="muted small">
              {t(`channel.${d.channel}`)}
              {simulated && <> · {t('notif.simulated')}</>} · {formatTime(d.updatedAt, locale)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
