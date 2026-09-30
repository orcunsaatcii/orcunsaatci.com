// src/app/(tr)/layout.tsx — TR kök layout (§8.4.4). M2 hâli (§15.3.1 #4): buildRootMetadata ve listPages (M3),
// ScrollDirector / MotionRoot / LenisProvider (M4), StageRoot (M5) ve SiteAnalytics (M9) sonraki milestone'larda eklenir.
import '../globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SkipLink } from '@/components/layout/SkipLink';
import { themeColors } from '@/design/tokens';
import { getExperienceProfile, resolveTypePreset } from '@/experience/profile';
import { fontVariables } from '@/fonts';
import { getDictionary } from '@/i18n/get-dictionary';
import { getEnPaths, getPerson } from '@/lib/content';
import { headScript } from '@/lib/head-script';

const LOCALE = 'tr' as const;
// Geçici (§15.0.6): M3'te getExperienceProfile(getSite().persona) olur (§4.17, §6.3.7)
const PROFILE = getExperienceProfile('engineer');
const PALETTE = PROFILE.palette;
resolveTypePreset(PROFILE.type); // v1'de yalnız hassas fontları var; editoryal istenirse uyarıyla hassas (K-PERSONA-4)
const NAME = getPerson().name;

export const dynamic = 'error'; // D-06: dinamik API kullanan her alt route build'i düşürür
// Geçici (§15.0.6): M3'te buildRootMetadata(LOCALE) (§11.2)
export const metadata: Metadata = { title: { default: NAME, template: `%s — ${NAME}` } };
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // env(safe-area-inset-*) (§6.4, §9.5)
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeColors(PALETTE, 'light').canvas },
    { media: '(prefers-color-scheme: dark)', color: themeColors(PALETTE, 'dark').canvas },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const dict = getDictionary(LOCALE);
  const enPaths = getEnPaths(); // Geçici (§15.3.1 #4): M3'te listPages() türetmesi

  return (
    <html lang={LOCALE} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body>
        <SkipLink label={dict.a11y.skipToContent} />
        <SiteHeader locale={LOCALE} enPaths={enPaths} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter locale={LOCALE} enPaths={enPaths} variant="full" />
      </body>
    </html>
  );
}
