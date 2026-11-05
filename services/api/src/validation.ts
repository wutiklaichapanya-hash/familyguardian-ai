import { z } from 'zod';
import { MOODS, SHARE_CATEGORIES } from '@fg/shared';

export const uuid = z.uuid();
export const idParam = z.object({ id: z.uuid() });
export const seniorParam = z.object({ seniorId: z.uuid() });
export const userIdParam = z.object({ userId: z.uuid() });
export const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

export const loginReq = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(256) });
export const registerReq = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(['senior', 'family']),
  locale: z.enum(['th', 'en']).optional(),
  politeParticle: z.enum(['ka', 'krap']).optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{3,20}$/, 'invalid phone').optional(),
});
export const createCheckinReq = z.object({
  mood: z.enum(MOODS), note: z.string().trim().max(1000).optional(), noteShared: z.boolean().optional(), onlyMe: z.boolean().optional(),
});
const phone = z.string().trim().regex(/^[0-9+\-\s()]{3,20}$/, 'invalid phone');
export const createContactReq = z.object({ name: z.string().trim().min(1).max(100), relationship: z.string().trim().min(1).max(60), phone });
export const callLogReq = z.object({ contactId: z.uuid().optional(), directoryEntryId: z.uuid().optional() })
  .refine((v) => !!v.contactId !== !!v.directoryEntryId, 'exactly one of contactId or directoryEntryId');
export const helpRequestReq = z.object({ message: z.string().trim().max(500).optional() });
export const scamCheckReq = z.object({
  text: z.string().max(5000).optional(), url: z.string().trim().max(2048).optional(), phone: z.string().trim().max(32).optional(),
  locale: z.enum(['th', 'en']).optional(),
}).refine((v) => Buffer.byteLength(v.text ?? '', 'utf8') <= 5 * 1024, 'text must be at most 5 KB');
export const shareReq = z.object({ shareWithUserIds: z.array(z.uuid()).min(1).max(20) });
export const guardianPauseReq = z.object({
  amountThb: z.number().int().min(0).max(100_000_000),
  answers: z.object({
    knowsRecipientPersonally: z.boolean(), pressuredToActNow: z.boolean(), toldToKeepSecret: z.boolean(), verifiedIndependently: z.boolean(),
  }),
  recipientNote: z.string().trim().max(300).optional(),
});
export const inviteReq = z.object({
  inviteeName: z.string().trim().min(1).max(100), relationship: z.string().trim().min(1).max(60), role: z.enum(['family', 'caregiver']),
});
export const acceptInviteReq = z.object({ token: z.string().min(10).max(200) });
export const stepUpReq = z.object({ password: z.string().min(1).max(256) });
export const createGrantReq = z.object({ granteeUserId: z.uuid(), category: z.enum(SHARE_CATEGORIES), expiresAt: z.iso.datetime({ offset: true }).optional(), password: z.string().max(256).optional() });
export const directoryQuery = z.object({ country: z.string().trim().toUpperCase().length(2).default('TH') });
export const checkoutReq = z.object({ planId: z.enum(['free', 'family_care', 'guardian_plus']) });

/** JSON Schema for OpenAPI docs only (validation is done by zod in handlers). */
export function doc(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _s, ...rest } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  return rest;
}
