// All user-facing ScamShield / Guardian Pause copy. Bilingual, calm, short sentences.
// Never a "safe" verdict; never claims an agency was notified (see FORBIDDEN_PHRASES).
import type { RiskLevel } from '@fg/shared';
import type { Bi } from './rules';

export const OVERALL: Record<RiskLevel, Bi> = {
  high_risk: {
    th: 'พบสัญญาณเสี่ยงสูง ข้อความนี้มีหลายอย่างที่มิจฉาชีพมักใช้ หยุดก่อน อย่าโอนเงิน อย่ากดลิงก์ และอย่าให้รหัสใดๆ แล้วตรวจสอบกับคนที่ไว้ใจ',
    en: 'High risk signs found. This message has several things scammers often use. Stop first. Do not send money, tap links or give any code. Check with someone you trust.',
  },
  caution: {
    th: 'พบสัญญาณที่ควรระวัง ยังสรุปไม่ได้ว่าเป็นการหลอกลวง แต่ควรตรวจสอบก่อนทำตามข้อความนี้',
    en: 'Some warning signs found. We cannot say for sure it is a scam, but please check before you do what the message asks.',
  },
  low_signals: {
    th: 'ไม่พบสัญญาณเสี่ยงที่ชัดเจน — แต่ยังควรตรวจสอบ ระบบนี้ไม่สามารถยืนยันได้ว่าข้อความไม่มีปัญหา',
    en: 'No clear signals found — still verify. This check cannot confirm that a message is fine.',
  },
  cannot_assess: {
    th: 'ประเมินไม่ได้ ข้อมูลสั้นเกินไปหรืออ่านไม่ออก ลองวางข้อความทั้งหมด ลิงก์ หรือเบอร์โทรที่ได้รับ',
    en: 'We cannot assess this. The input is too short or could not be read. Try pasting the whole message, the link or the phone number.',
  },
};

export const UNCERTAINTY_BASE: Bi = {
  th: 'ผลนี้มาจากการเทียบรูปแบบข้อความเท่านั้น ระบบไม่ได้เปิดลิงก์ ไม่ได้ตรวจเบอร์กับหน่วยงาน และอาจพลาดได้ทั้งสองทาง',
  en: 'This result only compares wording patterns. We did not open any link or check the number with anyone. It can be wrong either way.',
};
export const UNCERTAINTY_PHONE: Bi = {
  th: 'เบอร์ที่โทรเข้ามาอาจถูกปลอมให้ดูเหมือนเบอร์จริงได้ แม้แต่เบอร์ของธนาคาร',
  en: 'Caller numbers can be faked to look real, even a bank\'s number.',
};
export const UNCERTAINTY_TRUNCATED: Bi = {
  th: 'ข้อความยาวมาก เราตรวจเฉพาะส่วนแรกเท่านั้น',
  en: 'The message is very long. We only checked the first part.',
};
export const UNCERTAINTY_LANGUAGE: Bi = {
  th: 'ระบบตรวจได้เฉพาะภาษาไทยและภาษาอังกฤษ',
  en: 'This check only understands Thai and English.',
};
export const UNCERTAINTY_UNPARSEABLE_URL: Bi = {
  th: 'อ่านลิงก์ที่ให้มาไม่ออก จึงไม่ได้ตรวจลิงก์',
  en: 'We could not read the link you gave, so the link was not checked.',
};

export const STEPS = {
  officialNumber: {
    th: 'ติดต่อหน่วยงานนั้นด้วยเบอร์ทางการที่คุณหาเอง เช่น หลังบัตรหรือในแอป ไม่ใช่เบอร์ในข้อความนี้',
    en: 'Contact the organisation using an official number you look up yourself, such as on your card or in its app. Do not use the number in this message.',
  },
  askFamily: {
    th: 'ถามลูกหลานหรือคนในครอบครัวที่ไว้ใจก่อนทำอะไร',
    en: 'Ask a family member you trust before doing anything.',
  },
  aoc1441: {
    th: 'ถ้าสงสัยว่าเป็นมิจฉาชีพออนไลน์ โทรศูนย์ AOC 1441 (ดูเบอร์ในหน้าเบอร์ช่วยเหลือของแอป)',
    en: 'If you suspect an online scam, call the AOC hotline 1441 (see the help numbers page in the app).',
  },
  neverShareOtp: {
    th: 'อย่าบอกรหัส OTP หรือรหัสผ่านกับใคร แม้คนนั้นจะบอกว่าเป็นเจ้าหน้าที่',
    en: 'Never share an OTP or password with anyone, even if they say they are an official.',
  },
  noAppsFromLinks: {
    th: 'อย่าติดตั้งแอปจากลิงก์ ติดตั้งจาก App Store หรือ Google Play เท่านั้น',
    en: 'Do not install apps from links. Only use the App Store or Google Play.',
  },
  noLinks: {
    th: 'อย่ากดลิงก์ในข้อความ ให้เปิดแอปหรือพิมพ์ชื่อเว็บทางการเอง',
    en: 'Do not tap the link in the message. Open the official app or type the official address yourself.',
  },
  hangUp: {
    th: 'ถ้ากำลังคุยโทรศัพท์อยู่ วางสายได้เลย แล้วโทรกลับด้วยเบอร์ทางการเอง',
    en: 'If you are on a call, it is okay to hang up. Then call back using the official number yourself.',
  },
  oldNumber: {
    th: 'ถ้าอ้างว่าเป็นคนในครอบครัว ให้โทรหาเบอร์เดิมที่คุณบันทึกไว้ หรือถามเรื่องที่รู้กันแค่ในครอบครัว',
    en: 'If they say they are family, call the old number you have saved, or ask something only your family would know.',
  },
  noMoney: {
    th: 'ยังไม่ต้องโอนเงินหรือจ่ายค่าธรรมเนียมใดๆ จนกว่าจะตรวจสอบแล้ว',
    en: 'Do not send money or pay any fee until you have checked.',
  },
  pasteMore: {
    th: 'ลองวางข้อความทั้งหมด ลิงก์ หรือเบอร์โทรอีกครั้ง',
    en: 'Try again with the whole message, the link or the phone number.',
  },
} satisfies Record<string, Bi>;

// ---------------- Guardian Pause ----------------
export const PAUSE = {
  unknownUnverified: {
    th: 'คุณไม่รู้จักผู้รับเป็นการส่วนตัว และยังไม่ได้ตรวจสอบด้วยตัวเอง ลองโทรถามด้วยเบอร์ที่คุณหาเองก่อน',
    en: 'You do not know the person personally and have not checked on your own. Please call them using a number you find yourself first.',
  },
  unknown: {
    th: 'คุณไม่รู้จักผู้รับเป็นการส่วนตัว ตรวจชื่อบัญชีให้ตรงก่อนโอน',
    en: 'You do not know the person personally. Check the account name carefully before sending.',
  },
  unverified: {
    th: 'คุณยังไม่ได้ตรวจสอบด้วยตัวเอง ลองโทรหาผู้รับด้วยเบอร์ที่คุณบันทึกไว้เอง',
    en: 'You have not checked on your own yet. Try calling the person on a number you already have saved.',
  },
  secret: {
    th: 'มีคนบอกให้เก็บเรื่องนี้เป็นความลับ เรื่องเงินที่ถูกต้องไม่ต้องปิดบังครอบครัว ลองเล่าให้คนที่ไว้ใจฟังก่อน',
    en: 'Someone told you to keep this secret. A genuine payment does not need to be hidden from family. Please tell someone you trust first.',
  },
  pressure: {
    th: 'มีคนเร่งให้รีบโอน การเร่งเป็นวิธีที่มิจฉาชีพใช้บ่อย คุณมีสิทธิ์ใช้เวลาคิดก่อน',
    en: 'Someone is pushing you to send now. Rushing is a common scam tactic. You are allowed to take your time.',
  },
  largeAmount: {
    th: 'จำนวนเงินค่อนข้างสูง ถ้าโอนไปแล้วอาจขอคืนได้ยาก',
    en: 'This is a large amount. If it is sent, it may be hard to get back.',
  },
  noteRisk: {
    th: 'บันทึกเกี่ยวกับผู้รับมีคำที่มิจฉาชีพมักใช้ เช่น บัญชีพิเศษสำหรับตรวจสอบเงิน หรือค่าธรรมเนียมก่อนรับเงิน',
    en: 'Your note about the recipient has words that scammers often use, such as a special account to "check" your money, or a fee before receiving money.',
  },
  proceedWithCare: {
    th: 'คำตอบของคุณมีสัญญาณเตือนน้อย แต่ยังควรตรวจชื่อบัญชีผู้รับอีกครั้งก่อนกดโอน',
    en: 'Your answers show few warning signs. Still, please check the recipient\'s account name once more before you send.',
  },
  amountUnclear: {
    th: 'จำนวนเงินไม่ชัดเจน ลองตรวจตัวเลขอีกครั้ง',
    en: 'The amount is unclear. Please check the number again.',
  },
} satisfies Record<string, Bi>;
