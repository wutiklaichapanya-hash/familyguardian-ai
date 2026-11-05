// Text rule families for ScamShield (Thai + English).
// Thai patterns run on the whitespace-free text (Thai has no word spaces and scammers
// insert spaces to dodge filters). English patterns run on the space-collapsed text.
// All input is lower-cased + NFKC-normalised first (see normalize.ts).
import type { ScamSignal } from '@fg/shared';

export type Weight = 1 | 2 | 3;
export type Bi = { th: string; en: string };

export interface TextRule {
  /** Rule family id. Evidence is de-duplicated per family. */
  id: string;
  signal: ScamSignal;
  weight: Weight;
  /** Only reported when some OTHER non-context family also fired (e.g. a bare bank name). */
  contextOnly?: boolean;
  /** Skip a match that is preceded by a negation ("never share your OTP"). */
  negatable?: boolean;
  /** Counts as a "strong action" (asks the person to DO something risky). */
  action?: boolean;
  th?: RegExp[];
  en?: RegExp[];
  explanation: Bi;
}

// ---------- shared fragments ----------
const LINK_TH = '(?:ลิงก์|ลิงค์|ลิ้งค์|ลิ้งก์|ลิ้ง|ลิงก|link)';
const ASK_TH = '(?:แจ้ง|ส่ง|กรอก|ขอ|บอก|ยืนยัน|พิมพ์|ระบุ|อ่าน|ใส่|อัปเดต|อัพเดท|อัพเดต|แคป|ถ่ายรูป)';
const FAMILY_TH = '(?:แม่|พ่อ|ลูก|หลาน|ยาย|ตา|ป้า|น้า|อา|พี่|น้อง|ปู่|ย่า|คุณแม่|คุณพ่อ)';

const rx = (s: string) => new RegExp(s);

export const TEXT_RULES: TextRule[] = [
  // ---------------- impersonation ----------------
  {
    id: 'impersonation_authority',
    signal: 'impersonation',
    weight: 2,
    th: [
      rx('(?:เจ้าหน้าที่|จนท\\.?)(?:จาก)?(?:ธนาคาร|ตำรวจ|สรรพากร|ไปรษณีย์|การไฟฟ้า|ดีเอสไอ|dsi|กรม|ศุลกากร|ประกันสังคม|ขนส่ง|ปปง|ป\\.ป\\.ง|ศาล|ค่ายมือถือ|กสทช)'),
      rx('(?:ผม|ดิฉัน|เรา|นี่|นี้)(?:คือ|เป็น|ชื่อ)?(?:ร\\.?ต\\.?อ\\.?|พ\\.?ต\\.?ท\\.?|ด\\.?ต\\.?|ส\\.?ต\\.?ต\\.?|จ\\.?ส\\.?ต\\.?)?(?:ตำรวจ|สารวัตร|นายตำรวจ|เจ้าหน้าที่ตำรวจ|ดีเอสไอ|dsi|อัยการ)'),
      rx('(?:ติดต่อ|โทร|แจ้ง)(?:มา)?จาก(?:สถานีตำรวจ|สภ\\.|สน\\.|กรมสอบสวนคดีพิเศษ|ดีเอสไอ|dsi|กรมสรรพากร|สรรพากร|ศาล|ปปง|ป\\.ป\\.ง|การไฟฟ้า|กฟภ|กฟน|ธนาคาร)'),
      rx('(?:กรมสอบสวนคดีพิเศษ|สำนักงานป\\.?ป\\.?ง|ปปง\\.?แจ้ง|ศาลออกหมาย)'),
    ],
    en: [
      /\b(?:this is|i am|i'm|calling from|message from|we are|on behalf of)\s+(?:the\s+)?(?:police|officer|inspector|dsi|department of special investigation|revenue department|customs|court|amlo|anti[- ]money laundering)/,
      /\b(?:police|dsi|customs|revenue department|court)\s+(?:officer|official|department|investigator)\b/,
    ],
    explanation: {
      th: 'ข้อความอ้างว่ามาจากตำรวจหรือหน่วยงานรัฐ มิจฉาชีพมักแอบอ้างแบบนี้ หน่วยงานจริงไม่ติดต่อขอเงินทางโทรศัพท์หรือแชท',
      en: 'The message claims to be from the police or a government office. Scammers often pretend to be officials. Real officials do not ask for money by phone or chat.',
    },
  },
  {
    id: 'impersonation_courier',
    signal: 'impersonation',
    weight: 2,
    th: [
      rx('พัสดุ(?:ของ(?:คุณ|ท่าน))?(?:ตกค้าง|ถูกระงับ|ถูกกัก|ส่งไม่ได้|ไม่สามารถจัดส่ง|จัดส่งไม่สำเร็จ|ติดศุลกากร|มีสิ่งผิดกฎหมาย|ผิดกฎหมาย|ตีกลับ|รอการยืนยัน)'),
      rx('(?:ที่อยู่|ข้อมูลที่อยู่)(?:จัดส่ง)?(?:ไม่ครบ|ไม่ถูกต้อง|ไม่สมบูรณ์).{0,30}' + LINK_TH),
    ],
    en: [
      /\b(?:your\s+)?(?:parcel|package|shipment|delivery)\s+(?:is|has been|was|could not be|cannot be|can't be)\s+(?:on hold|held|returned|undeliverable|suspended|delivered|seized|detained)/,
      /\b(?:incomplete|incorrect|invalid)\s+(?:shipping\s+|delivery\s+)?address\b/,
    ],
    explanation: {
      th: 'ข้อความอ้างเรื่องพัสดุมีปัญหา นี่เป็นมุกที่มิจฉาชีพใช้บ่อย ให้เช็กเลขพัสดุในแอปหรือเว็บของบริษัทขนส่งเอง',
      en: 'The message says a parcel has a problem. This is a common scam story. Check the tracking number in the courier\'s own app or website.',
    },
  },
  {
    id: 'impersonation_tax_utility_telco',
    signal: 'impersonation',
    weight: 2,
    th: [
      rx('(?:ขอ)?คืนภาษี|เงินคืนภาษี|ภาษีคืน'),
      rx('ค่าไฟ(?:ฟ้า)?(?:ค้างชำระ|เกิน|คืน|ส่วนเกิน)|คืนค่าไฟ|เงินคืนค่าไฟ|ค่าประกันมิเตอร์'),
      rx('(?:ค่าย|ซิม|หมายเลข|เบอร์)(?:มือถือ)?(?:ของคุณ)?(?:จะ)?(?:ถูก)?(?:ระงับ|ปิด|ยกเลิก)'),
    ],
    en: [
      /\btax refund\b|\brefund (?:of|for) (?:your )?(?:tax|electricity)|\belectricity (?:bill )?(?:refund|overcharge|overpayment)/,
      /\byour (?:sim|mobile number|phone number) (?:will be|is being|has been) (?:suspended|blocked|deactivated)/,
    ],
    explanation: {
      th: 'ข้อความอ้างว่ามาจากสรรพากร การไฟฟ้า หรือค่ายมือถือ มิจฉาชีพชอบใช้ชื่อหน่วยงานเหล่านี้ ให้ติดต่อหน่วยงานผ่านช่องทางทางการเอง',
      en: 'The message claims to be from the Revenue Department, the power company or a phone company. Scammers often use these names. Contact them through their official channels yourself.',
    },
  },
  {
    id: 'impersonation_family_new_number',
    signal: 'impersonation',
    weight: 3,
    th: [
      rx(FAMILY_TH + '.{0,20}(?:เปลี่ยนเบอร์|เบอร์ใหม่|เปลี่ยนไลน์|ไลน์ใหม่|lineใหม่|ไอดีใหม่|เปลี่ยนไอดี)'),
      rx('(?:เปลี่ยนเบอร์|เบอร์ใหม่|เปลี่ยนไลน์|ไลน์ใหม่|lineใหม่).{0,25}(?:' + FAMILY_TH + '|ลบเบอร์เก่า|เบอร์เก่า|เมมเบอร์|บันทึกเบอร์)'),
      rx('(?:นี่|นี้)(?:ลูก|หลาน)(?:ชาย|สาว)?เอง'),
      rx('จำ(?:หนู|ผม|เสียงหนู|เสียงผม|เสียงหลาน)ได้ไหม'),
    ],
    en: [
      /\b(?:this is|it's|it is) my new (?:number|phone|whatsapp|line)\b/,
      /\b(?:hi|hello|hey) (?:mum|mom|dad|grandma|grandpa|granny|auntie)\b.{0,40}\bnew (?:number|phone)\b/,
      /\bnew (?:number|phone)\b.{0,40}\b(?:mum|mom|dad|grandma|grandpa|delete (?:the|my) old)\b/,
      /\bit'?s me,? your (?:son|daughter|grandson|granddaughter|nephew|niece)\b/,
    ],
    explanation: {
      th: 'มีคนอ้างว่าเป็นคนในครอบครัวที่เปลี่ยนเบอร์หรือไลน์ใหม่ มิจฉาชีพใช้วิธีนี้บ่อย ให้โทรหาเบอร์เดิมที่คุณบันทึกไว้เพื่อถามตรงๆ',
      en: 'Someone says they are a family member with a new number or account. Scammers use this trick often. Call the old number you already have saved and ask directly.',
    },
  },
  {
    id: 'impersonation_org_mention',
    signal: 'impersonation',
    weight: 1,
    contextOnly: true,
    th: [
      rx('ธนาคาร|กสิกร|ไทยพาณิชย์|กรุงไทย|กรุงศรี|ออมสิน|ธ\\.?ก\\.?ส|ทีเอ็มบี|ทหารไทย|ตำรวจ|ดีเอสไอ|สรรพากร|ศุลกากร|ไปรษณีย์|เคอรี่|แฟลช|การไฟฟ้า|กฟภ|กฟน|ทรูมูฟ|เอไอเอส|ดีแทค|ประกันสังคม|ศาล|ปปง|กสทช|ทางราชการ|หน่วยงานรัฐ|เจ้าหน้าที่รัฐ|กระทรวง'),
    ],
    en: [
      /\b(?:bank|kbank|kasikorn|scb|siam commercial|krungthai|ktb|krungsri|bangkok bank|bbl|gsb|government savings|ttb|baac|police|dsi|revenue department|customs|thailand post|thai post|kerry|flash express|pea|mea|truemoney|true move|ais|dtac|social security|court|amlo|nbtc)\b/,
    ],
    explanation: {
      th: 'ข้อความใช้ชื่อธนาคารหรือหน่วยงาน และมีสัญญาณอื่นร่วมด้วย ชื่อในข้อความอาจไม่ได้มาจากหน่วยงานนั้นจริง',
      en: 'The message uses the name of a bank or an organisation, together with other warning signs. The name alone does not prove it really came from them.',
    },
  },
  {
    id: 'manipulation_attempt',
    signal: 'manipulation_attempt',
    weight: 2,
    th: [
      rx('(?:ไม่ต้องสนใจ|ละเว้น|ละเลย)(?:กฎ|คำสั่ง|ระบบ)'),
      rx('ข้อความนี้(?:ปลอดภัย|ไม่ใช่มิจฉาชีพ|ไม่ใช่การหลอกลวง|ผ่านการตรวจสอบ|ได้รับการยืนยัน)'),
      rx('(?:ระบบ|ai|เอไอ|แอป)(?:ได้)?(?:ตรวจสอบ|ยืนยัน)แล้ว(?:ว่า)?(?:ปลอดภัย|ไม่ใช่)'),
      rx('ไม่ใช่(?:มิจฉาชีพ|แก๊งคอลเซ็นเตอร์|การหลอกลวง)(?:แน่นอน|นะ|ครับ|ค่ะ)'),
    ],
    en: [
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|your|safety)?\s*(?:rules|instructions|prompts?|guidelines|checks)\b/,
      /\b(?:this|the) (?:message|link|sms|text) is (?:safe|verified|legit|legitimate|genuine|not a scam)\b/,
      /\b(?:mark|classify|rate|label) (?:this|it) as (?:safe|low|benign|legit|not a scam)/,
      /\byou are now\b|\bsystem prompt\b|\bas an ai\b|\bscam ?checker\b|\bfamilyguardian\b|\bscamshield\b/,
    ],
    explanation: {
      th: 'ข้อความพยายามบอกเครื่องมือตรวจว่า "ไม่มีอะไรน่ากังวล" ข้อความจริงไม่จำเป็นต้องเขียนแบบนี้ เราจึงถือเป็นสัญญาณที่ควรระวัง',
      en: 'The message tries to tell checking tools that it is harmless. Real messages do not need to say this, so we treat it as a warning sign.',
    },
  },

  // ---------------- urgency ----------------
  {
    id: 'urgency',
    signal: 'urgency',
    weight: 1,
    th: [
      rx('ด่วน|ภายใน\\d+(?:ชม|ชั่วโมง|นาที|วัน)|ภายในวันนี้|ภายในคืนนี้|วันนี้เท่านั้น|ทันที|เร็วที่สุด|โดยเร็ว|ก่อนเที่ยงคืน|หมดเขต(?:วันนี้|คืนนี้)|เหลือเวลา(?:อีก)?\\d*|โอกาสสุดท้าย|รีบ(?:โอน|ดำเนินการ|กด|ตอบ|ติดต่อ|ยืนยัน)'),
    ],
    en: [
      /\burgent(?:ly)?\b|\bimmediately\b|\bright now\b|\bwithin \d+ ?(?:hours?|hrs?|h|minutes?|mins?|days?)\b|\btoday only\b|\blast chance\b|\bact now\b|\bexpires? (?:today|tonight|soon|in \d+)|\bfinal (?:notice|warning|reminder)\b|\basap\b|\bbefore midnight\b/,
    ],
    explanation: {
      th: 'ข้อความเร่งให้รีบทำ การเร่งรีบทำให้เราไม่มีเวลาคิดหรือถามคนอื่น',
      en: 'The message pushes you to hurry. Rushing leaves no time to think or ask someone.',
    },
  },

  // ---------------- secrecy ----------------
  {
    id: 'secrecy',
    signal: 'secrecy',
    weight: 2,
    th: [
      rx('อย่าบอก(?:ใคร|ลูก|หลาน|ครอบครัว|คนอื่น|ธนาคาร|พนักงาน)|ห้ามบอก(?:ใคร|ลูก|หลาน|ครอบครัว|คนอื่น|ธนาคาร|พนักงาน)|เป็นความลับ|เก็บไว้เป็นความลับ|ไม่ต้องบอก(?:ใคร|ลูก|หลาน|ครอบครัว|คนอื่น)|อย่าให้(?:ใคร|ลูก|หลาน)รู้|ห้ามวางสาย|อย่าวางสาย|ห้ามปรึกษา|อย่าปรึกษา|ห้ามแจ้ง(?:ใคร|ลูก|หลาน)'),
    ],
    en: [
      /\b(?:don'?t|do not|never) (?:tell|inform|mention (?:this )?to) (?:anyone|anybody|your (?:family|children|kids|son|daughter|bank))\b|\bkeep (?:this|it) (?:a )?secret\b|\bjust between us\b|\btell no one\b|\b(?:don'?t|do not) hang up\b|\b(?:don'?t|do not) (?:discuss|share) this with\b|\bstrictly confidential\b/,
    ],
    explanation: {
      th: 'ข้อความขอให้เก็บเป็นความลับหรือห้ามวางสาย มิจฉาชีพไม่อยากให้คุณปรึกษาใคร คุณมีสิทธิ์ปรึกษาคนที่ไว้ใจได้เสมอ',
      en: 'The message asks you to keep it secret or stay on the line. Scammers do not want you to talk to anyone. You can always ask someone you trust.',
    },
  },

  // ---------------- credentials ----------------
  {
    id: 'credential_request',
    signal: 'credential_request',
    weight: 3,
    negatable: true,
    action: true,
    th: [
      rx(ASK_TH + '.{0,20}(?:รหัสผ่าน|พาสเวิร์ด|password|รหัสพิน|รหัสpin|pincode|เลขpin|รหัสบัตร|รหัสatm|รหัสเอทีเอ็ม|เลขบัตรประชาชน|เลขบัตรประจำตัว|เลขบัตรเครดิต|เลขบัตรเดบิต|เลขหลังบัตร|cvv|หน้าบัตร|ข้อมูลบัตร|ข้อมูลบัญชี|ชื่อผู้ใช้|username|ข้อมูลส่วนตัว|รหัสเข้าแอป|รหัสเข้าสู่ระบบ)'),
      rx('ยืนยันตัวตน(?:ผ่าน|ที่|ใน|ทาง)?' + LINK_TH),
      rx('(?:สแกน|ถ่าย)(?:ใบหน้า|หน้า)(?:ยืนยัน|เพื่อ)|ถ่ายรูป(?:คู่)?(?:กับ)?บัตร(?:ประชาชน)?'),
      rx('(?:เข้าสู่ระบบ|ล็อกอิน|login)(?:ผ่าน|ที่|ใน|ทาง)' + LINK_TH),
    ],
    en: [
      /\b(?:enter|send|provide|confirm|verify|share|tell|give|update|reply with|type|submit|re-?enter)\b.{0,30}\b(?:password|pin|passcode|card number|cvv|cvc|login details|username|id card|national id|account details|bank details|banking details|personal details|security code|online banking)/,
      /\bverify your (?:account|identity|bank account|details)\b/,
      /\b(?:log ?in|sign ?in)\b.{0,20}\b(?:via|using|through|at) (?:this|the|our) link\b/,
    ],
    explanation: {
      th: 'ข้อความขอรหัสผ่าน รหัส PIN หรือข้อมูลบัตร หน่วยงานจริงจะไม่ขอข้อมูลเหล่านี้ทางข้อความหรือโทรศัพท์',
      en: 'The message asks for a password, PIN or card details. Real organisations never ask for these by message or phone.',
    },
  },
  {
    id: 'otp_request',
    signal: 'otp_request',
    weight: 3,
    negatable: true,
    action: true,
    th: [
      rx('(?:แจ้ง|ส่ง|บอก|อ่าน|ขอ|กรอก|ใส่|พิมพ์|แคป|ถ่ายรูป|ยืนยัน)(?:เลข|รหัส)?.{0,15}(?:otp|โอทีพี|รหัสยืนยัน|รหัส6หลัก|รหัสหกหลัก|เลข6หลัก|รหัสที่ได้รับ|รหัสที่ส่งไป|รหัสในsms|รหัสทางsms|รหัสในข้อความ)'),
      rx('(?:otp|โอทีพี|รหัส6หลัก|รหัสที่ได้รับ).{0,15}(?:มาให้|ให้(?:ผม|ฉัน|หนู|เรา|เจ้าหน้าที่|พนักงาน|ทาง)|ทางไลน์|ในแชท|กลับมา)'),
    ],
    en: [
      /\b(?:send|tell|read|share|give|forward|provide|enter|type|reply with|confirm|repeat)\b.{0,30}\b(?:otp|one[- ]time (?:password|code|pin)|verification code|6[- ]digit code|six[- ]digit code|code (?:we|i) (?:just )?sent|code you (?:just )?received|security code)\b/,
      /\b(?:otp|verification code|the code)\b.{0,20}\b(?:to me|to us|back to|to the officer|to our agent)\b/,
    ],
    explanation: {
      th: 'ข้อความขอรหัส OTP OTP ใช้ยืนยันการทำรายการของคุณเอง ใครได้ไปอาจเข้าบัญชีหรือโอนเงินออกได้ ห้ามบอกใครเด็ดขาด',
      en: 'The message asks for a one-time code (OTP). The OTP approves actions on your account. Anyone who gets it may move your money. Never share it.',
    },
  },

  // ---------------- remote access / apps ----------------
  {
    id: 'remote_access_app',
    signal: 'remote_access_app',
    weight: 3,
    negatable: true,
    action: true,
    th: [
      rx('anydesk|teamviewer|rustdesk|quicksupport|ultraviewer|airdroid|supremo|แอนนี่เดสก์|ทีมวิวเวอร์'),
      rx('(?:ไฟล์|แอป|แอพ)?\\.?apk'),
      rx('(?:ติดตั้ง|โหลด|ดาวน์โหลด|ดาวโหลด)(?:แอป|แอพ|แอปพลิเคชัน|แอพพลิเคชั่น|โปรแกรม).{0,20}(?:' + LINK_TH + '|ไลน์|line|ที่ส่งให้|ที่ส่งไป|ด้านล่าง)'),
      rx('แชร์หน้าจอ|เปิด(?:สิทธิ์|การ)(?:การ)?(?:เข้าถึง|ช่วยเหลือพิเศษ)|อนุญาต(?:ให้)?(?:ติดตั้ง|เข้าถึง)(?:แอป|จากแหล่งที่ไม่รู้จัก)?'),
    ],
    en: [
      /\b(?:anydesk|any desk|teamviewer|team viewer|rustdesk|quicksupport|ultraviewer|airdroid|supremo)\b/,
      /\.apk\b|\bapk file\b/,
      /\b(?:install|download)\b.{0,25}\b(?:app|application|software|program)\b.{0,20}\b(?:from|via|using|at|with) (?:this|the|our|my) link\b/,
      /\bscreen ?shar(?:e|ing)\b|\ballow (?:unknown sources|installation from)|\baccessibility (?:permission|service|access)\b|\bremote (?:access|control|support app)\b/,
    ],
    explanation: {
      th: 'ข้อความให้ติดตั้งแอปหรือแชร์หน้าจอ แอปแบบนี้อาจทำให้คนอื่นควบคุมโทรศัพท์และบัญชีธนาคารของคุณได้ ติดตั้งแอปจากสโตร์ทางการเท่านั้น',
      en: 'The message asks you to install an app or share your screen. Such apps can let a stranger control your phone and bank app. Only install apps from the official store.',
    },
  },

  // ---------------- payment ----------------
  {
    id: 'payment_strong',
    signal: 'payment_request',
    weight: 3,
    negatable: true,
    action: true,
    th: [
      rx('บัญชี(?:ที่)?(?:ปลอดภัย|ตรวจสอบ|พักเงิน|กลาง|ของเจ้าหน้าที่|ของทางราชการ|ของศาล)'),
      rx('โอน(?:เงิน)?.{0,20}(?:ไป|เข้า|มา)(?:ยัง|ที่)?บัญชี(?:นี้|ด้านล่าง|ที่แจ้ง|ที่ให้|ใหม่|ของ(?:เจ้าหน้าที่|ผม|ฉัน|หนู|เรา))'),
      rx('(?:ยืมเงิน|ขอยืม|ช่วยโอน|โอนให้(?:หนู|ผม|ฉัน|ก่อน)(?!.{0,4}แล้ว)|โอนด่วน|โอนก่อน|โอนเงินก่อน|ส่งเงินมา)'),
      rx('บัตรของขวัญ|giftcard|บัตรเติมเงิน|บิตคอยน์|bitcoin|usdt|คริปโต|เหรียญดิจิทัล'),
      rx('(?:ตรวจสอบ|พิสูจน์)(?:ความ)?(?:บริสุทธิ์|เส้นทาง)(?:ทาง)?(?:การ)?เงิน'),
    ],
    en: [
      /\b(?:transfer|move|send|wire|deposit)\b.{0,30}\b(?:to|into) (?:a |this |the |our |my )?(?:safe|secure|holding|protected|new|following|below|government|verification) account\b/,
      /\b(?:wire|send|transfer) (?:me|us) (?:the )?(?:money|funds|\d)|\blend me\b|\bcan you (?:send|transfer|lend)\b|\bborrow (?:some )?money\b/,
      /\bgift ?cards?\b|\bbitcoin\b|\busdt\b|\bcrypto(?:currency)? wallet\b|\bwestern union\b|\bmoneygram\b/,
    ],
    explanation: {
      th: 'ข้อความขอให้โอนเงิน ยืมเงิน หรือย้ายเงินไปบัญชีพิเศษเพื่อ "ตรวจสอบ" หน่วยงานจริงไม่มีบัญชีแบบนี้ ก่อนโอนให้หยุดและตรวจสอบกับคนที่ไว้ใจ',
      en: 'The message asks you to send, lend or move money (for example to a special account to "check" it). Real organisations have no such account. Stop and check with someone you trust before you pay.',
    },
  },
  {
    id: 'payment_generic',
    signal: 'payment_request',
    weight: 2,
    negatable: true,
    th: [
      rx('(?:กรุณา)?(?:โอนเงิน|โอนค่า|ย้ายเงิน|ชำระเงิน|ชำระค่า|จ่ายเงิน|จ่ายค่า|สแกนจ่าย|พร้อมเพย์|promptpay|เลขบัญชี)'),
    ],
    en: [
      /\b(?:please )?(?:pay|payment|transfer|deposit)\b.{0,20}\b(?:now|today|baht|thb|฿|\d)|\bpay (?:the|a|your|this)\b|\bpromptpay\b|\baccount number\b/,
    ],
    explanation: {
      th: 'ข้อความขอให้จ่ายหรือโอนเงิน ก่อนจ่ายให้ตรวจสอบกับหน่วยงานผ่านช่องทางทางการ เช่น แอปที่คุณใช้อยู่แล้ว',
      en: 'The message asks you to pay or transfer money. Before paying, check with the organisation through an official channel, such as an app you already use.',
    },
  },
  {
    id: 'advance_fee',
    signal: 'advance_fee',
    weight: 3,
    negatable: true,
    action: true,
    th: [
      rx('(?:ค่าธรรมเนียม|ค่าดำเนินการ|ค่าภาษี|ค่าประกัน|ค่ามัดจำ|ค่าเอกสาร|ค่าปลดล็อก|ค่าปลดล็อค|ค่าค้ำ|ค่าอากร|ค่าปรับ|ค่ายืนยัน|ค่าเปิดบัญชี|ค่าถอน).{0,30}(?:ก่อน|จึงจะ|ถึงจะ|เพื่อ(?:รับ|ปลด|ถอน|อนุมัติ)|ปลดล็อก|ถอนเงิน|อนุมัติ|เงินกู้|สินเชื่อ|รางวัล)'),
      rx('(?:เงินกู้|สินเชื่อ|กู้เงิน|รางวัล|ถอนเงิน|ปลดล็อก|ปลดล็อค|อนุมัติ).{0,40}(?:ค่าธรรมเนียม|ค่าดำเนินการ|ค่าภาษี|ค่ามัดจำ|ค่าประกัน|ค่าเอกสาร|ชำระก่อน|โอนก่อน|จ่ายก่อน|วางเงิน)'),
      rx('(?:ชำระ|จ่าย|โอน).{0,15}(?:ค่า(?:ธรรมเนียม|ดำเนินการ|จัดส่ง|ส่ง)(?:ใหม่|เพิ่ม|อีกครั้ง)|ค่าภาษีศุลกากร|ค่าส่งใหม่)'),
    ],
    en: [
      /\b(?:pay|send|transfer|deposit)\b.{0,30}\b(?:processing|release|clearance|handling|redelivery|re-delivery|customs|unlock|activation|withdrawal|administration|insurance|approval) (?:fee|charge|tax|deposit)\b/,
      /\b(?:fee|tax|deposit|charge)\b.{0,30}\b(?:to|before (?:we|you) (?:can )?) ?(?:release|receive|claim|unlock|withdraw|approve|process|get) (?:your|the)\b/,
      /\b(?:loan|prize|winnings|reward|refund)\b.{0,40}\b(?:pay|send|transfer)\b.{0,15}\b(?:fee|deposit|tax)\b/,
    ],
    explanation: {
      th: 'ข้อความให้จ่าย "ค่าธรรมเนียม" ก่อนจึงจะได้เงินกู้ รางวัล หรือพัสดุ นี่เป็นรูปแบบหลอกลวงที่พบบ่อย ของจริงไม่ต้องจ่ายก่อนแบบนี้',
      en: 'The message asks for a fee first, before you get a loan, prize or parcel. This is a common scam pattern. Real offers do not work this way.',
    },
  },

  // ---------------- investment ----------------
  {
    id: 'investment_promise',
    signal: 'investment_promise',
    weight: 2,
    th: [
      rx('ผลตอบแทน.{0,15}(?:\\d+(?:\\.\\d+)?%|สูง|การันตี|รับประกัน|แน่นอน|ต่อวัน|ต่อเดือน|ทุกวัน|วันละ)'),
      rx('การันตี(?:ผล|กำไร|รายได้|ไม่ขาดทุน)|รับประกัน(?:กำไร|ผลตอบแทน|ไม่ขาดทุน)|กำไร.{0,10}(?:\\d+(?:\\.\\d+)?%|แน่นอน|ทุกวัน|ต่อวัน|วันละ)'),
      rx('ไม่มีความเสี่ยง|ไม่มีขาดทุน|ไม่ขาดทุนแน่นอน|เงินต่อเงิน|ลงทุน(?:น้อย|เพียง|แค่)\\d*.{0,20}(?:ได้|รับ|กำไร)'),
      rx('(?:รายได้เสริม|งานออนไลน์|ทำงานที่บ้าน|งานพาร์ทไทม์|กดไลก์|กดไลค์|รีวิวสินค้า).{0,25}(?:วันละ|ต่อวัน|รายได้|\\d+บาท)'),
    ],
    en: [
      /\bguaranteed (?:returns?|profits?|income|payouts?)\b|\b\d+(?:\.\d+)?\s?% (?:daily|per day|a day|weekly|per week|monthly|per month)\b/,
      /\brisk[- ]free\b|\bno risk\b|\bdouble your money\b|\b(?:earn|make) (?:up to )?(?:\$|฿|thb ?)?\d[\d,]* (?:baht |thb )?(?:a|per|every) (?:day|week)\b/,
      /\b(?:vip|private) (?:trading|investment|signal) group\b|\bcrypto (?:investment|trading) (?:platform|opportunity)\b|\btask[- ]based (?:job|work)\b/,
    ],
    explanation: {
      th: 'ข้อความสัญญาว่าได้กำไรสูงหรือ "ไม่มีความเสี่ยง" การลงทุนจริงไม่มีใครรับประกันผลตอบแทนได้',
      en: 'The message promises high or "risk-free" returns. No real investment can guarantee profit.',
    },
  },

  // ---------------- threats ----------------
  {
    id: 'threat_or_fear',
    signal: 'threat_or_fear',
    weight: 3,
    th: [
      rx('(?:บัญชี|บัตร)(?:ของ(?:คุณ|ท่าน))?.{0,15}(?:อายัด|ระงับ|ล็อก|ล็อค|แช่แข็ง|ยึด|ถูกปิด|จะปิด|ปิดการใช้งาน)'),
      rx('หมายจับ|หมายเรียก|ถูกดำเนินคดี|ดำเนินคดี|ฟอกเงิน|คดียาเสพติด|พัวพัน|เกี่ยวข้องกับ(?:คดี|ขบวนการ|การฟอกเงิน)|ติดคุก|จำคุก|ถูกจับ|เป็นผู้ต้องหา|บัญชีม้า'),
      rx('ตัดไฟ|ระงับการจ่ายไฟ|ตัด(?:สัญญาณ|น้ำประปา|บริการ)|มีสิ่งผิดกฎหมาย|ยาเสพติด|หนังสือเดินทางปลอม'),
    ],
    en: [
      /\b(?:account|card|funds|money|assets)\b.{0,25}\b(?:frozen|suspended|locked|closed|blocked|terminated|seized)\b/,
      /\barrest warrant\b|\bwarrant for your arrest\b|\bwill be arrested\b|\blegal action\b|\bmoney laundering\b|\bcriminal (?:case|charges?|investigation)\b|\bmule account\b/,
      /\b(?:power|electricity|service|number|sim|line)\b.{0,20}\b(?:cut off|disconnected|terminated)\b|\billegal (?:items|substances|goods)\b|\bdrugs (?:were )?found\b/,
    ],
    explanation: {
      th: 'ข้อความขู่ให้กลัว เช่น บัญชีจะถูกอายัดหรือมีหมายจับ หน่วยงานจริงจะส่งเอกสารทางการ และไม่ให้แก้ปัญหาด้วยการโอนเงินทางโทรศัพท์',
      en: 'The message uses fear, such as a frozen account or an arrest warrant. Real agencies send official letters and never ask you to fix it by sending money over the phone.',
    },
  },

  // ---------------- prize ----------------
  {
    id: 'prize_or_lottery',
    signal: 'prize_or_lottery',
    weight: 2,
    th: [
      rx('ถูก(?:รางวัล|ลอตเตอรี่|ล็อตเตอรี่|หวย)|(?:ได้รับ|คุณได้|ยินดีด้วย|ขอแสดงความยินดี).{0,20}(?:รางวัล|ลอตเตอรี่|ล็อตเตอรี่|เงินรางวัล)'),
      rx('รางวัลใหญ่|ผู้โชคดี|จับฉลาก|ลุ้นรับ|รับของรางวัล|เงินรางวัล|รับสิทธิ์ฟรี|แจกฟรี|รับฟรี'),
    ],
    en: [
      /\byou(?:'ve| have)? (?:won|been selected|been chosen)\b|\bcongratulations\b.{0,40}\b(?:won|winner|prize|selected|reward)\b/,
      /\blottery\b|\blucky (?:draw|winner|customer)\b|\bclaim (?:your )?(?:prize|reward|gift|winnings)\b|\bjackpot\b|\bfree (?:iphone|gift|reward)\b/,
    ],
    explanation: {
      th: 'ข้อความบอกว่าคุณได้รางวัลหรือถูกรางวัล ถ้าคุณไม่ได้ร่วมสนุกเอง ให้สงสัยไว้ก่อน รางวัลจริงไม่ต้องจ่ายเงินเพื่อรับ',
      en: 'The message says you won a prize. If you did not enter, be doubtful. A real prize never asks you to pay to receive it.',
    },
  },

  // ---------------- romance ----------------
  {
    id: 'romance',
    signal: 'romance',
    weight: 2,
    th: [
      rx('(?:ที่รัก|สุดที่รัก|ดาร์ลิ่ง|ฮันนี่).{0,40}(?:โอน|เงิน|ช่วย|ศุลกากร|ของขวัญ|ตั๋ว|ค่าเครื่องบิน|ติดอยู่|ค่ารักษา)'),
      rx('(?:ส่ง|ฝาก)(?:กล่อง)?ของขวัญ.{0,25}(?:มาให้|จากต่างประเทศ|ทางเครื่องบิน)'),
      rx('ทหาร(?:อเมริกัน|สหรัฐ|ต่างชาติ|ยูเอ็น|un)|วิศวกร(?:แท่นขุดเจาะ|น้ำมัน|ต่างประเทศ)|หมอ(?:ทหาร|สหประชาชาติ)'),
      rx('(?:รักคุณ|คิดถึงคุณ|อยากแต่งงาน).{0,40}(?:โอน|เงิน|ช่วย(?:ค่า|จ่าย)|ค่าตั๋ว)'),
    ],
    en: [
      /\b(?:my love|darling|sweetheart|my dear|babe)\b.{0,60}\b(?:money|transfer|send|customs|ticket|stuck|fee|hospital bill)\b/,
      /\b(?:us|american|un|united nations) (?:soldier|army|doctor|general)\b|\boil rig\b|\bdeployed (?:overseas|abroad)\b/,
      /\bi (?:have )?(?:fell|fallen) in love with you\b|\b(?:sent|send|sending) (?:you )?a (?:gift|package|box) from\b|\bwe(?:'ve| have) never met\b/,
    ],
    explanation: {
      th: 'ข้อความใช้ความรักหรือความสนิทใจ แล้วขอเงินหรือพูดถึงของขวัญจากต่างประเทศ นี่เป็นรูปแบบหลอกลวงทางความรักที่พบบ่อย',
      en: 'The message uses love or closeness and then talks about money or a gift from abroad. This is a common romance scam pattern.',
    },
  },

  // ---------------- links mentioned in text ----------------
  {
    id: 'link_prompt',
    signal: 'suspicious_link',
    weight: 1,
    negatable: true,
    th: [rx('(?:คลิก|คลิ๊ก|กด|เข้า|แตะ)(?:ที่)?' + LINK_TH)],
    en: [/\b(?:click|tap|open|visit|follow) (?:on )?(?:the |this |below |our )?(?:link|url)\b/],
    explanation: {
      th: 'ข้อความให้กดลิงก์ ลิงก์อาจพาไปหน้าเว็บปลอม ให้เข้าแอปหรือเว็บของหน่วยงานเองแทน',
      en: 'The message asks you to tap a link. Links can lead to fake pages. Open the organisation\'s own app or website yourself instead.',
    },
  },
];

/** Preceding-window negations ("never share", "อย่าบอก OTP"). */
export const NEGATION_TH = /(?:ไม่|ห้าม|อย่า|ไม่มีนโยบาย|ไม่เคย)/;
export const NEGATION_EN = /\b(?:never|not|don'?t|do not|won'?t|will not|no one|nobody|cannot|can'?t|isn'?t)\b/;
/** A secrecy phrase inside the window must not be read as a negation ("อย่าบอกใคร ส่ง OTP มา"). */
export const SECRECY_IN_WINDOW = /อย่าบอกใคร|ห้ามบอกใคร|ไม่ต้องบอก|อย่าให้ใครรู้|ห้ามวางสาย|don'?t tell|do not tell|don'?t hang up|tell no one/;
