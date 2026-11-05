import type { Metadata, Viewport } from 'next';
import { Prompt, Sarabun } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import './globals.css';

// Self-hosted at build time by next/font. CSS falls back to the system Thai stack if unavailable.
// Prompt: headings, buttons and navigation. Sarabun: body text (looped Thai, highly legible for older readers).
const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-head',
});
const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  // No `title` here: AppShell renders a localised, route-specific <title> (WCAG 2.4.2) and a
  // metadata title would add a second, generic <title> that browsers would prefer.
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
    { media: '(prefers-color-scheme: light)', color: '#FBF8F3' },
    { media: '(prefers-color-scheme: dark)', color: '#121816' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={`${prompt.variable} ${sarabun.variable}`} data-audience="senior">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
