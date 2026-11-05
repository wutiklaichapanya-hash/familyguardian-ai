// Make untrusted text inert for display: no clickable or auto-detected links (contract v0.2, item 7).
// "https://evil.example.com/x" -> "hxxps://evil[.]example[.]com/x". Idempotent.
// Phone numbers stay plain text; <meta name="format-detection" content="telephone=no"> stops auto-linking.
export function defang(text: string): string {
  return text
    .replace(/\bh(?:tt|xx)p(s?):\/\//gi, 'hxxp$1://')
    .replace(/(\S)\.(?=[a-z฀-๿]{2,})/gi, '$1[.]')
    .replace(/(?<!\[)@(?!\])/g, '[@]');
}
