import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FamilyGuardian AI (demo)',
    short_name: 'FamilyGuardian',
    description: 'ดูแลกันในครอบครัว — โหมดสาธิต ข้อมูลทั้งหมดเป็นข้อมูลสมมติ',
    lang: 'th',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FBF8F3',
    theme_color: '#2F6F6A',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
