import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import './globals.css';

// Self-hosted at build time by next/font. CSS falls back to the system Thai stack if unavailable.
const notoThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-thai',
});

export const metadata: Metadata = {
  title: { default: 'FamilyGuardian', template: '%s · FamilyGuardian' },
  description: 'FamilyGuardian AI — demo with fictional data only.',
  applicationName: 'FamilyGuardian',
  robots: { index: false, follow: false },
  // Never auto-link numbers or addresses (scam text must stay inert).
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximum-scale: people must be able to zoom (WCAG 1.4.4).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2F6F6A' },
    { media: '(prefers-color-scheme: dark)', color: '#121816' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={notoThai.variable} data-audience="senior">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
