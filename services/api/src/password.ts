// Password strength for self-registration (SR-24, v0.3). Deliberately simple and explainable:
// 12–256 characters; at least 3 of {lowercase, uppercase, digit, symbol} unless 16+ characters (passphrases);
// not a common password; must not contain the email's local part.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', '123456789012', '1234567890', 'qwertyuiop', 'qwerty123456',
  'iloveyou', 'letmein', 'welcome', 'admin', 'abc123', '111111111111', '000000000000', 'familyguardian',
  'demo-senior-2026', 'demo-family-2026', 'demo-care-2026', 'demo-admin-2026',
]);

export const PASSWORD_MIN = 12;

export function passwordProblems(password: string, email = ''): string[] {
  const out: string[] = [];
  if (password.length < PASSWORD_MIN) out.push(`at least ${PASSWORD_MIN} characters`);
  if (password.length > 256) out.push('at most 256 characters');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length < 16 && classes < 3) out.push('mix at least 3 of: lowercase, uppercase, digits, symbols (or use 16+ characters)');
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) out.push('too common');
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 3 && lower.includes(local)) out.push('must not contain your email name');
  return out;
}
