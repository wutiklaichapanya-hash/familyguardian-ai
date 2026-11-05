import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeUrl, assessScam, extractUrls } from '../src/index';
import { registrableDomain } from '../src/url';

const ids = (u: string) => analyzeUrl(u).findings.map((f) => f.id);

describe('lexical URL analysis', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never touches the network', () => {
    const spy = vi.fn(() => { throw new Error('network!'); });
    vi.stubGlobal('fetch', spy);
    assessScam({ text: 'go to https://kbank-secure.xyz/login', url: 'https://bit.ly/abc' });
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('IP host', () => expect(ids('http://203.0.113.5/login')).toContain('url_ip_host'));
  it('punycode', () => expect(ids('https://xn--kbnk-4na.com')).toContain('url_punycode'));
  it('unicode homograph host is punycoded by the parser', () => expect(ids('https://kbаnk.com/login')).toContain('url_punycode'));
  it('@ in authority', () => expect(ids('https://kasikornbank.com@198.51.100.7/x')).toContain('url_at_sign'));
  it('http not https', () => expect(ids('http://example.com')).toContain('url_no_https'));
  it('apk', () => expect(ids('https://example.com/files/update.apk')).toContain('url_apk'));
  it('excessive subdomains', () => expect(ids('https://a.b.c.d.example.com')).toContain('url_many_subdomains'));
  it('risky TLD', () => expect(ids('https://promo-th.xyz')).toContain('url_risky_tld'));

  it.each(['bit.ly/abc', 'https://tinyurl.com/x', 'cutt.ly/x', 's.id/abc', 'https://rb.gy/x'])('shortener %s', (u) => {
    expect(ids(u)).toContain('url_shortener');
  });

  it.each([
    'kbank-secure.xyz', 'https://kasikornbank-login.com', 'scb-online.net', 'https://krungthai-update.info',
    'bangkokbank-th.com', 'gsb-th.com', 'https://ktb-verify.com', 'true-reward.com', 'ais-th.net', 'line-th-security.top',
    'thaipost-th.xyz', 'kerry-th.com', 'flash-delivery.top', 'pea-service.online', 'https://k8ank-secure.com',
  ])('look-alike brand %s', (u) => expect(ids(u)).toContain('url_brand_lookalike'));

  it.each([
    'https://www.kasikornbank.com/th', 'https://www.scb.co.th', 'https://krungthai.com', 'https://www.bangkokbank.com',
    'https://www.gsb.or.th', 'https://line.me/R/ti/p/x', 'https://www.thailandpost.co.th', 'https://th.kerryexpress.com',
    'https://www.pea.co.th', 'https://www.mea.or.th', 'https://www.rd.go.th', 'https://airline.com', 'https://online-shop.com',
  ])('official / unrelated domain %s is not a look-alike', (u) => expect(ids(u)).not.toContain('url_brand_lookalike'));

  it('registrable domain handles .co.th', () => {
    expect(registrableDomain('www.scb.co.th')).toBe('scb.co.th');
    expect(registrableDomain('scb.co.th.evil.xyz')).toBe('evil.xyz');
  });

  it('extracts URLs glued to Thai text, skips emails and numbers', () => {
    const found = extractUrls('กดที่kbank-secure.xyz/loginด่วน ติดต่อ a@b.com ราคา 1.500 บาท').map((u) => u.raw);
    expect(found).toEqual(['kbank-secure.xyz/login']);
  });

  it('a lone look-alike link with a risky TLD is high risk', () => {
    expect(assessScam({ url: 'http://kbank-secure.xyz/login' }).risk).toBe('high_risk');
  });
  it('an official link alone is low_signals, never "safe"', () => {
    const r = assessScam({ url: 'https://www.kasikornbank.com/th/personal' });
    expect(r.risk).toBe('low_signals');
  });
});
