// ============================================================================
//  SYNTHETIC DEMO DATA ONLY — fictitious people, fictitious 08x-000-000x numbers.
//  Idempotent: every run RESETS the database's application tables, then re-seeds.
//  Usage: pnpm db:seed
// ============================================================================
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { assessScam } from '@fg/ai';
import type { Mood, ShareCategory } from '@fg/shared';
import { createDb, type Db } from './client';
import {
  actionLogs, alerts, consentGrants, contentShares, directoryEntries, families, familyMemberships, notifications,
  scamAssessments, trustedContacts, users, wellbeingCheckins,
} from './schema';
import { hashPassword } from '../auth';
import { recordAudit } from '../audit';
import { notificationCopy } from '../notifications/copy';

const DAY = 86_400_000;
export const CONSENT_TEXT_VERSION = 'consent-v1';

export const DEMO_USERS = {
  somsri: { email: 'somsri@demo.fg', password: 'Demo-Senior-2026', role: 'senior', displayName: 'สมศรี (Somsri)', politeParticle: 'ka' },
  nok: { email: 'nok@demo.fg', password: 'Demo-Family-2026', role: 'family', displayName: 'นก (Nok)', politeParticle: 'ka' },
  anan: { email: 'anan@demo.fg', password: 'Demo-Family-2026', role: 'family', displayName: 'อนันต์ (Anan)', politeParticle: 'krap' },
  pim: { email: 'pim@demo.fg', password: 'Demo-Care-2026', role: 'caregiver', displayName: 'พิม (Pim)', politeParticle: 'ka' },
  admin: { email: 'admin@demo.fg', password: 'Demo-Admin-2026', role: 'admin', displayName: 'Admin (Demo Operator)', politeParticle: 'krap' },
} as const;

export const DEMO_GRANTS: Record<'nok' | 'anan' | 'pim', ShareCategory[]> = {
  nok: ['checkins', 'help_requests', 'scam_checks', 'transfer_pauses', 'contacts'],
  anan: [],
  pim: ['help_requests', 'care_tasks'],
};

/** Official numbers — ALL marked needs_human_verification, sourceUrl null. No bank numbers. */
export const DIRECTORY_SEED = [
  { phone: '1669', kind: 'medical_emergency', nameTh: 'การแพทย์ฉุกเฉิน 1669', nameEn: 'Emergency Medical Services 1669', purposeTh: 'เจ็บป่วยฉุกเฉิน อุบัติเหตุ', purposeEn: 'Medical emergencies and accidents', sortOrder: 1 },
  { phone: '191', kind: 'police', nameTh: 'ตำรวจ 191', nameEn: 'Police 191', purposeTh: 'เหตุด่วนเหตุร้าย', purposeEn: 'Police emergencies', sortOrder: 2 },
  { phone: '1441', kind: 'anti_scam', nameTh: 'ศูนย์ AOC 1441 (ภัยออนไลน์)', nameEn: 'AOC 1441 anti-online-scam centre', purposeTh: 'แจ้งและปรึกษาเรื่องมิจฉาชีพออนไลน์ ตลอด 24 ชั่วโมง', purposeEn: 'Report and get advice on online scams, 24 hours', sortOrder: 3 },
  { phone: '1300', kind: 'social_support', nameTh: 'ศูนย์ช่วยเหลือสังคม 1300 (พม.)', nameEn: 'Social Assistance Hotline 1300 (MSDHS)', purposeTh: 'ขอความช่วยเหลือทางสังคม รวมถึงการถูกทำร้ายหรือแสวงประโยชน์จากผู้สูงอายุ', purposeEn: 'Social assistance, including elder abuse and exploitation', sortOrder: 4 },
] as const;

const SYNTHETIC_SCAM_TEXT = '[SYNTHETIC] ธนาคารแจ้ง: บัญชีของท่านถูกระงับ กรุณายืนยันตัวตนด่วนภายใน 24 ชม. ที่ http://bit.ly/verify-acc-demo และแจ้งรหัส OTP ที่ได้รับ ห้ามบอกผู้อื่น';

export async function seedDemo(db: Db, now = new Date()) {
  // 1. Reset (TRUNCATE also covers append-only audit_events; this is a SYNTHETIC demo/test reset only).
  const tables = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  const names = [...tables].map((t) => `"public"."${t.tablename}"`);
  if (names.length) await db.execute(sql.raw(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`));

  // 2. Users
  const ids = {} as Record<keyof typeof DEMO_USERS, string>;
  for (const [key, u] of Object.entries(DEMO_USERS) as [keyof typeof DEMO_USERS, (typeof DEMO_USERS)[keyof typeof DEMO_USERS]][]) {
    const [row] = await db.insert(users).values({
      email: u.email, passwordHash: await hashPassword(u.password), displayName: u.displayName, role: u.role,
      locale: 'th', politeParticle: u.politeParticle, isSynthetic: true,
    }).returning({ id: users.id });
    ids[key] = row!.id;
  }

  // 3. Family + confirmed memberships
  const [fam] = await db.insert(families).values({ name: 'ครอบครัวสมศรี (SYNTHETIC demo)', seniorId: ids.somsri }).returning({ id: families.id });
  const familyId = fam!.id;
  const joined = new Date(now.getTime() - 30 * DAY);
  for (const [key, rel, role] of [['nok', 'ลูกสาว (daughter)', 'family'], ['anan', 'ลูกชาย (son)', 'family'], ['pim', 'ผู้ดูแล (caregiver)', 'caregiver']] as const) {
    await db.insert(familyMemberships).values({ familyId, userId: ids[key], role, relationship: rel, status: 'active', joinedAt: new Date(joined.getTime() + (key === 'nok' ? 0 : key === 'anan' ? 1000 : 2000)), confirmedAt: joined });
  }

  // 4. Grants (exactly as the brief lists)
  for (const key of ['nok', 'anan', 'pim'] as const) {
    for (const category of DEMO_GRANTS[key]) {
      await db.insert(consentGrants).values({
        familyId, seniorId: ids.somsri, granteeUserId: ids[key], category, createdBy: ids.somsri,
        createdAt: joined, expiresAt: new Date(now.getTime() + 60 * DAY), consentTextVersion: CONSENT_TEXT_VERSION,
      });
    }
  }

  // 5. Trusted contacts (fictitious numbers)
  await db.insert(trustedContacts).values([
    { seniorId: ids.somsri, name: 'นก (Nok)', relationship: 'ลูกสาว', phone: '081-000-0001', linkedUserId: ids.nok },
    { seniorId: ids.somsri, name: 'อนันต์ (Anan)', relationship: 'ลูกชาย', phone: '081-000-0002', linkedUserId: ids.anan },
    { seniorId: ids.somsri, name: 'พิม (Pim)', relationship: 'ผู้ดูแล', phone: '082-000-0003', linkedUserId: ids.pim },
  ]);

  // 6. Directory
  for (const d of DIRECTORY_SEED) {
    await db.insert(directoryEntries).values({ country: 'TH', ...d, verification: 'needs_human_verification', sourceUrl: null });
  }

  // 7. 14 days of check-ins with gaps (days 3, 6 and 10 have none — a gap is NOT a decline).
  const plan: Record<number, { mood: Mood; note?: string; noteShared?: boolean; onlyMe?: boolean }> = {
    0: { mood: 'okay' }, 1: { mood: 'happy', note: 'ไปตลาดกับเพื่อนบ้าน (synthetic)', noteShared: true }, 2: { mood: 'tired' },
    4: { mood: 'worried', note: 'บันทึกส่วนตัว (synthetic)', onlyMe: true }, 5: { mood: 'okay' }, 7: { mood: 'happy' },
    8: { mood: 'prefer_not_to_answer' }, 9: { mood: 'okay', note: 'ไม่แชร์ (synthetic)', noteShared: false }, 11: { mood: 'lonely' },
    12: { mood: 'happy' }, 13: { mood: 'okay' },
  };
  const at = (daysAgo: number, hour = 2) => new Date(now.getTime() - daysAgo * DAY - hour * 3_600_000);
  for (const [d, c] of Object.entries(plan)) {
    await db.insert(wellbeingCheckins).values({ seniorId: ids.somsri, mood: c.mood, note: c.note ?? null, noteShared: c.noteShared ?? false, onlyMe: c.onlyMe ?? false, createdAt: at(Number(d)) });
  }

  // 8. One shared scam check (shared with Nok, who holds 'scam_checks')
  const result = assessScam({ text: SYNTHETIC_SCAM_TEXT, locale: 'th' });
  const scamAt = at(1, 5);
  const [scam] = await db.insert(scamAssessments).values({
    seniorId: ids.somsri, inputText: SYNTHETIC_SCAM_TEXT, locale: 'th', risk: result.risk, result, shared: true, createdAt: scamAt,
  }).returning({ id: scamAssessments.id });
  await db.insert(contentShares).values({ seniorId: ids.somsri, category: 'scam_checks', itemId: scam!.id, userId: ids.nok, createdAt: scamAt });
  const [scamAlert] = await db.insert(alerts).values({
    seniorId: ids.somsri, kind: 'shared_scam_check', origin: 'system_warning', category: 'scam_checks',
    summary: notificationCopy('shared_scam_check', DEMO_USERS.somsri.displayName, 'en').title, sourceId: scam!.id, createdAt: scamAt,
  }).returning({ id: alerts.id });
  const scamCopy = notificationCopy('shared_scam_check', DEMO_USERS.somsri.displayName, 'th');
  await db.insert(notifications).values({
    alertId: scamAlert!.id, seniorId: ids.somsri, recipientId: ids.nok, category: 'scam_checks', channel: 'push_simulated',
    ...scamCopy, state: 'seen', attempts: 1, createdAt: scamAt, updatedAt: scamAt, sentAt: scamAt, seenAt: scamAt,
  });

  // 9. One acknowledged past help alert (5 days ago): Nok acknowledged, Pim saw it.
  const helpAt = at(5, 6);
  const ackAt = new Date(helpAt.getTime() + 4 * 60_000);
  const [help] = await db.insert(alerts).values({
    seniorId: ids.somsri, kind: 'user_requested_help', origin: 'user_requested', category: 'help_requests',
    summary: notificationCopy('user_requested_help', DEMO_USERS.somsri.displayName, 'en').title, createdAt: helpAt, acknowledgedBy: ids.nok, acknowledgedAt: ackAt,
  }).returning({ id: alerts.id });
  const helpCopy = notificationCopy('user_requested_help', DEMO_USERS.somsri.displayName, 'th');
  await db.insert(notifications).values([
    { alertId: help!.id, seniorId: ids.somsri, recipientId: ids.nok, category: 'help_requests', channel: 'push_simulated', ...helpCopy, state: 'acknowledged', attempts: 1, createdAt: helpAt, updatedAt: ackAt, sentAt: helpAt, seenAt: ackAt, acknowledgedAt: ackAt },
    { alertId: help!.id, seniorId: ids.somsri, recipientId: ids.pim, category: 'help_requests', channel: 'push_simulated', ...helpCopy, state: 'seen', attempts: 1, createdAt: helpAt, updatedAt: ackAt, sentAt: helpAt, seenAt: ackAt },
  ]);
  await db.insert(actionLogs).values([
    { userId: ids.somsri, kind: 'help_request_sent', label: 'Help request queued for 2 member(s) (simulated notification)', createdAt: helpAt },
    { userId: ids.somsri, kind: 'alert_acknowledged', label: `Acknowledged by ${DEMO_USERS.nok.displayName}`, createdAt: ackAt },
  ]);

  await recordAudit(db, { action: 'seed.synthetic_demo_reset', meta: { synthetic: true } });
  return { ids, familyId, scamCheckId: scam!.id, helpAlertId: help!.id, scamRisk: result.risk };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
  const { db, close } = createDb(url, { max: 2 });
  seedDemo(db)
    .then((r) => {
      console.log('SYNTHETIC demo data seeded (database reset). Accounts: ' + Object.values(DEMO_USERS).map((u) => u.email).join(', '));
      console.log(`scam check risk from @fg/ai: ${r.scamRisk}`);
    })
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => close());
}
