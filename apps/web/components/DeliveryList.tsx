'use client';

import type { DeliveryDTO } from '@fg/shared';
import { deliveryPresentation } from '@/lib/delivery';
import { formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { Chip } from './ui';

/**
 * Honest delivery states. A simulated channel is the primary sentence ("simulated delivery to X only"),
 * never a confident "sent" with a small suffix; it is not counted as delivery.
 */
export function DeliveryList({ deliveries }: { deliveries: DeliveryDTO[] }) {
  const { t, locale } = useI18n();
  return (
    <ul className="list-plain">
      {deliveries.map((d) => {
        const p = deliveryPresentation(d);
        return (
          <li key={d.notificationId}>
            <div className="row">
              <span>{t(p.line, { name: d.recipientName })}</span>
              <Chip tone={p.tone} icon={p.icon}>{t(p.chip)}</Chip>
            </div>
            <span className="muted small">
              {t(`channel.${d.channel}`)}
              {p.simulated && <> · {t('delivery.simulatedNote')}</>} · {formatTime(d.updatedAt, locale)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
