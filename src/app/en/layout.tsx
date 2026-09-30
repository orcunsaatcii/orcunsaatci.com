// src/app/en/layout.tsx — EN kök layout (§8.4.4). M3 hâli: buildRootMetadata, listPages türetmesi ve persona paleti.
// §8.5.1 sırası: SkipLink, StageRoot, header, main > ScrollDirector, footer, MotionRoot, LenisProvider. SiteAnalytics M9'da.
import '../globals.css';
import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SkipLink } from '@/components/layout/SkipLink';
import { LenisProvider } from '@/components/motion/LenisProvider';
import { MotionRoot } from '@/components/motion/MotionRoot';
import { themeColors } from '@/design/tokens';
import { getExperienceProfile, resolveTypePreset } from '@/experience/profile';
import { fontVariables } from '@/fonts';
import { getDictionary } from '@/i18n/get-dictionary';
import { getSite } from '@/lib/content';
import { headScript } from '@/lib/head-script';
import { footprintRadius } from '@/lib/section-geometry';
import { buildRootMetadata, listEnPaths } from '@/lib/seo/metadata';
import { ScrollDirector } from '@/stage/ScrollDirector';
import { StageRoot } from '@/stage/StageRoot';

const LOCALE = 'en' as const;
const PROFILE = getExperienceProfile(getSite().persona); // build zamanı palet seçimi (§4.17, §6.3.7)
const PALETTE = PROFILE.palette;
resolveTypePreset(PROFILE.type); // v1'de yalnız hassas fontları var; editoryal istenirse uyarıyla hassas (K-PERSONA-4)
const { radii, shape } = PROFILE.stone;
// hero posterinin dikey yerleşimi: radii.y / R0 (engineer 0.775, neutral 0.833; §5.16.4)
const ROOT_STYLE = {
  '--stone-ry': (radii[1] / footprintRadius(radii, shape[0])).toFixed(3),
} as CSSProperties;

export const dynamic = 'error'; // D-06: dinamik API kullanan her alt route build'i düşürür
export const metadata: Metadata = buildRootMetadata(LOCALE); // §11.2
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
  const enPaths = listEnPaths(); // listPages() → EN karşılığı olan yollar (§8.4.4)

  return (
    <html lang={LOCALE} className={fontVariables} style={ROOT_STYLE} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body>
        <SkipLink label={dict.a11y.skipToContent} />
        <StageRoot persona={PROFILE.persona} />
        <SiteHeader locale={LOCALE} enPaths={enPaths} />
        <main id="main" tabIndex={-1}>
          <ScrollDirector>{children}</ScrollDirector>
        </main>
        <SiteFooter locale={LOCALE} enPaths={enPaths} variant="full" />
        <MotionRoot />
        <LenisProvider />
      </body>
    </html>
  );
}
