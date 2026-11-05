import { describe, expect, it } from 'vitest';
import { RISK_LABELS, SCAM_SIGNALS, type ScamSignal } from '@fg/shared';
import { assessScam, ENGINE_VERSION, riskRank } from '../src/index';

describe('assessScam contract', () => {
  it('returns the engine block and all fields', () => {
    const r = assessScam({ text: 'สวัสดีค่ะ พรุ่งนี้เจอกันที่ตลาดนะ' });
    expect(r.engine).toEqual({ name: 'rules', version: ENGINE_VERSION, aiExplainer: false });
    expect(typeof ENGINE_VERSION).toBe('string');
    for (const k of ['risk', 'evidence', 'explanation', 'uncertainty', 'verificationSteps'] as const) expect(r).toHaveProperty(k);
    expect(r).not.toHaveProperty('id');
    expect(r).not.toHaveProperty('sharedWith');
  });

  it('cannot_assess for empty, whitespace, too short, emoji only, unparseable url', () => {
    for (const req of [{}, { text: '' }, { text: '   ' }, { text: 'ok' }, { text: '👍🙏' }, { url: 'ht!tp:/??' }, { phone: '1' }]) {
      expect(assessScam(req).risk, JSON.stringify(req)).toBe('cannot_assess');
    }
    // garbage input types do not throw
    expect(assessScam({ text: 42 as unknown as string }).risk).toBe('cannot_assess');
  });

  it('low_signals wording never says safe and says still verify', () => {
    const r = assessScam({ text: 'แม่ เย็นนี้หนูกลับบ้านช้านิดนึงนะ' });
    expect(r.risk).toBe('low_signals');
    expect(r.explanation.en).toContain('No clear signals found — still verify');
    expect(r.explanation.th).toContain(RISK_LABELS.low_signals.th);
    expect(r.explanation.en.toLowerCase()).not.toMatch(/\bsafe\b/);
  });

  it('every result carries the required verification steps', () => {
    const r = assessScam({ text: 'Your account will be frozen. Send the OTP now.' });
    const en = r.verificationSteps.map((s) => s.en).join(' ');
    expect(en).toMatch(/official number you look up yourself/);
    expect(en).toMatch(/family member you trust/);
    expect(en).toMatch(/1441/);
    expect(en).toMatch(/Never share an OTP or password/);
    expect(en).toMatch(/Do not install apps from links/);
    for (const s of r.verificationSteps) { expect(s.th.length).toBeGreaterThan(0); expect(s.en.length).toBeGreaterThan(0); }
  });

  it('high_risk for credential/OTP/remote/payment combined with urgency or impersonation', () => {
    const cases = [
      'เจ้าหน้าที่ธนาคารแจ้งว่าต้องแจ้งรหัส OTP ด่วน',
      'This is the police. Install AnyDesk now so we can check your account.',
      'บัญชีของคุณจะถูกอายัด กรุณาโอนเงินไปบัญชีปลอดภัยทันที',
      'Urgent: verify your account and enter your password within 2 hours',
    ];
    for (const t of cases) expect(assessScam({ text: t }).risk, t).toBe('high_risk');
  });

  it('deterministic', () => {
    const t = 'พัสดุตกค้าง กรุณาชำระค่าจัดส่งใหม่ที่ bit.ly/x1';
    expect(assessScam({ text: t })).toEqual(assessScam({ text: t }));
  });
});

describe('every ScamSignal is detectable (Thai and English)', () => {
  const samples: Record<ScamSignal, string[]> = {
    impersonation: ['ผมเป็นเจ้าหน้าที่ตำรวจ สภ.เมือง', 'แม่ หนูเปลี่ยนเบอร์ใหม่นะ', 'พัสดุของคุณตกค้าง', 'Hi mum, this is my new number', 'This is officer from the police'],
    urgency: ['ด่วนมาก ต้องทำภายใน 24 ชม.', 'Act now, this offer expires today'],
    secrecy: ['เรื่องนี้อย่าบอกใครนะ', 'Do not tell anyone about this'],
    credential_request: ['กรุณากรอกรหัสผ่านและเลขบัตรประชาชน', 'Please enter your password and card number'],
    otp_request: ['แจ้งรหัส OTP ที่ได้รับให้เจ้าหน้าที่', 'Please send the OTP to me'],
    suspicious_link: ['เข้าไปที่ http://203.0.113.9/login', 'Update at https://secure-update.top/x'],
    lookalike_domain: ['ยืนยันที่ kbank-secure.xyz', 'Login at https://scb-online.com/verify'],
    link_shortener: ['ดูรายละเอียด bit.ly/abc123', 'details: tinyurl.com/xyz987'],
    advance_fee: ['ต้องจ่ายค่าธรรมเนียมก่อนจึงจะอนุมัติเงินกู้', 'Pay the processing fee to release your winnings'],
    investment_promise: ['ลงทุนน้อย การันตีกำไร 20% ต่อวัน', 'Guaranteed returns, risk-free'],
    payment_request: ['กรุณาโอนเงินไปบัญชีที่แจ้ง', 'Transfer the money to a safe account'],
    remote_access_app: ['ติดตั้ง AnyDesk เพื่อให้เจ้าหน้าที่ช่วย', 'Download TeamViewer so we can help', 'install app.apk'],
    threat_or_fear: ['บัญชีจะถูกอายัด มีหมายจับ', 'An arrest warrant has been issued'],
    prize_or_lottery: ['ยินดีด้วย คุณได้รับรางวัลใหญ่', 'Congratulations, you have won the lottery'],
    romance: ['ที่รัก ช่วยโอนค่าภาษีศุลกากรให้หน่อย', 'My love, please send money for my ticket'],
    unknown_number_pattern: [],
  };
  for (const sig of SCAM_SIGNALS) {
    it(sig, () => {
      if (sig === 'unknown_number_pattern') {
        expect(assessScam({ text: 'โทรกลับด่วน', phone: '+234 801 000 0001' }).evidence.some((e) => e.signal === sig)).toBe(true);
        expect(assessScam({ text: 'Call me back on +44 20 0000 0001 please' }).evidence.some((e) => e.signal === sig)).toBe(true);
        return;
      }
      for (const t of samples[sig]) {
        const r = assessScam({ text: t });
        expect(r.evidence.map((e) => e.signal), t).toContain(sig);
      }
    });
  }
});

describe('obfuscation: zero-width, spaced Thai, homoglyphs, Thai digits, double sara e', () => {
  it('spaced Thai letters still match', () => {
    expect(assessScam({ text: 'ด่ ว น บั ญ ชี จ ะ ถู ก อ า ยั ด' }).evidence.map((e) => e.signal)).toEqual(expect.arrayContaining(['urgency', 'threat_or_fear']));
  });
  it('zero-width characters inside words', () => {
    expect(assessScam({ text: 'แจ​ง​รหัส O​T​P ให้เจ้าหน้าที่' }).evidence.map((e) => e.signal)).toContain('otp_request');
  });
  it('Cyrillic look-alike letters', () => {
    expect(assessScam({ text: 'Please send the ОТР to me' }).evidence.map((e) => e.signal)).toContain('otp_request'); // Cyrillic О Т Р
  });
  it('เเ (two sara e) is read as แ', () => {
    expect(assessScam({ text: 'เเจ้งรหัส OTP ด่วน' }).evidence.map((e) => e.signal)).toContain('otp_request');
  });
  it('full-width Latin', () => {
    expect(assessScam({ text: 'ＡｎｙＤｅｓｋ install now' }).evidence.map((e) => e.signal)).toContain('remote_access_app');
  });
});

describe('negation awareness', () => {
  it('genuine warnings that mention OTP are not requests', () => {
    for (const t of ['Never share your OTP with anyone.', 'รหัส OTP ของคุณคือ 123456 ห้ามเปิดเผยรหัสนี้แก่ผู้อื่น', 'ธนาคารไม่มีนโยบายให้แจ้งรหัส OTP ทางโทรศัพท์']) {
      const r = assessScam({ text: t });
      expect(r.evidence.map((e) => e.signal), t).not.toContain('otp_request');
      expect(riskRank(r.risk)).toBeLessThan(riskRank('high_risk'));
    }
  });
  it('secrecy is not read as negation', () => {
    expect(assessScam({ text: 'อย่าบอกใคร แจ้งรหัส OTP มาให้ผม' }).risk).toBe('high_risk');
  });
});
