import type { DirectoryEntryDTO } from '@fg/shared';
import { th } from './i18n/th';
import { en } from './i18n/en';

/** Built-in backup list used when the API is unreachable or the visitor is not signed in.
 *  Every entry is marked needs_human_verification (B4) — the UI shows the badge. */
const NUMBERS = [
  { phone: '1669', kind: 'medical_emergency' },
  { phone: '191', kind: 'police' },
  { phone: '1441', kind: 'anti_scam' },
  { phone: '1300', kind: 'social_support' },
] as const;

export const FALLBACK_DIRECTORY: DirectoryEntryDTO[] = NUMBERS.map((n) => ({
  id: `fallback-${n.phone}`,
  country: 'TH',
  phone: n.phone,
  kind: n.kind,
  name: { th: th[`emergency.fallback.${n.phone}.name`], en: en[`emergency.fallback.${n.phone}.name`] },
  purpose: { th: th[`emergency.fallback.${n.phone}.purpose`], en: en[`emergency.fallback.${n.phone}.purpose`] },
  verification: 'needs_human_verification',
  sourceUrl: null,
  verifiedBy: null,
  verifiedAt: null,
}));
