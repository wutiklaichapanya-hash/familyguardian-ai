import type { PlanDTO } from '@fg/shared';

export type PlanId = PlanDTO['id'];

/*
 * PRICING IS A HYPOTHESIS TO VALIDATE, NOT A DECISION (see docs/product/01_DISCOVERY_AND_SCOPE.md, A10).
 * Free / ฿199 / ฿349 per month are starting points for willingness-to-pay research with
 * Thai families. Do not present these figures as final anywhere in the product; every
 * plan carries `hypothesis: true` so the UI can label them.
 *
 * Safety baseline: help requests, official help numbers (1669 / 191 / 1441) and the
 * basic scam check are NEVER gated behind a paid plan. Paid plans add capacity and
 * family-coordination features, not access to emergency help.
 *
 * `features` are stable feature keys (not display copy); the UI maps them to labels.
 */
export const PLANS: PlanDTO[] = [
  {
    id: 'free',
    name: { th: 'ฟรี', en: 'Free' },
    priceThbMonthly: 0,
    features: ['daily_checkin', 'help_request', 'official_help_numbers', 'scam_check_basic', 'guardian_pause', 'family_members_2'],
    hypothesis: true,
  },
  {
    id: 'family_care',
    name: { th: 'แฟมิลี่แคร์', en: 'Family Care' },
    priceThbMonthly: 199, // hypothesis to validate
    features: [
      'daily_checkin',
      'help_request',
      'official_help_numbers',
      'scam_check_extended',
      'family_members_5',
      'guardian_pause',
      'family_digest',
    ],
    hypothesis: true,
  },
  {
    id: 'guardian_plus',
    name: { th: 'การ์เดียนพลัส', en: 'Guardian Plus' },
    priceThbMonthly: 349, // hypothesis to validate
    features: [
      'daily_checkin',
      'help_request',
      'official_help_numbers',
      'scam_check_extended',
      'family_members_10',
      'guardian_pause',
      'family_digest',
      'care_tasks',
      'caregiver_access',
    ],
    hypothesis: true,
  },
];

export interface Entitlements {
  /** Family members / caregivers that can be invited (excluding the senior). */
  maxFamilyMembers: number;
  scamChecksPerDay: number;
  /** Transfer "Guardian Pause". Safety feature: free on every plan (owner decision 2026-11-05). */
  guardianPause: true;
  careTasks: boolean;
  caregiverAccess: boolean;
  familyDigest: boolean;
  /** Always true on every plan: help is never paywalled. */
  helpRequests: true;
  officialHelpNumbers: true;
}

export const ENTITLEMENTS: Readonly<Record<PlanId, Readonly<Entitlements>>> = {
  free: {
    maxFamilyMembers: 2,
    scamChecksPerDay: 5,
    guardianPause: true,
    careTasks: false,
    caregiverAccess: false,
    familyDigest: false,
    helpRequests: true,
    officialHelpNumbers: true,
  },
  family_care: {
    maxFamilyMembers: 5,
    scamChecksPerDay: 30,
    guardianPause: true,
    careTasks: false,
    caregiverAccess: false,
    familyDigest: true,
    helpRequests: true,
    officialHelpNumbers: true,
  },
  guardian_plus: {
    maxFamilyMembers: 10,
    scamChecksPerDay: 100,
    guardianPause: true,
    careTasks: true,
    caregiverAccess: true,
    familyDigest: true,
    helpRequests: true,
    officialHelpNumbers: true,
  },
};

export function isPlanId(v: unknown): v is PlanId {
  return v === 'free' || v === 'family_care' || v === 'guardian_plus';
}

export function getPlan(planId: PlanId): PlanDTO {
  const p = PLANS.find((x) => x.id === planId);
  if (!p) throw new Error(`Unknown plan: ${String(planId)}`);
  return p;
}

/** Entitlements for a plan id. Unknown ids fall back to `free` (fail closed on paid features, open on help). */
export function entitlementsFor(planId: PlanId | string | null | undefined): Entitlements {
  const id: PlanId = isPlanId(planId) ? planId : 'free';
  return { ...ENTITLEMENTS[id] };
}
