// src/lib/seo/og.tsx — OG ve ikon görsellerinin ortak render modülü (§11.5.3). M2 hâli: yalnız loadOgFonts ve
// renderDial (ikonlar için, §11.2.5); renderOg, fitTitle, coverDataUri ve angleFor M3'te eklenir.
// Yalnız görsel route'ları ve icon.tsx / apple-icon.tsx import eder.
import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { themeColors } from '@/design/tokens';
import { getExperienceProfile } from '@/experience/profile';
import { polar } from '@/lib/section-geometry';

type OgFont = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' };
const FONT_DIR = join(process.cwd(), 'assets/fonts/ttf');
let fontsPromise: Promise<OgFont[]> | undefined;

export function loadOgFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all([
    readFile(join(FONT_DIR, 'MonaSans-WideBold.ttf')), // wdth 125, wght 760 statik örnek (≈ 43 KB)
    readFile(join(FONT_DIR, 'MonaSans-Text.ttf')), // wdth 100, wght 450 (≈ 43 KB)
    readFile(join(FONT_DIR, 'MartianMono-Regular.ttf')), // (≈ 18 KB)
  ]).then(([wide, text, mono]) => [
    { name: 'MonaWide', data: wide, weight: 700, style: 'normal' }, // Satori ağırlık adımı; gerçek glif 760
    { name: 'MonaText', data: text, weight: 400, style: 'normal' },
    { name: 'MartianMono', data: mono, weight: 400, style: 'normal' },
  ]);
  return fontsPromise;
}

// Paylaşım görselleri her zaman etkin paletin koyu değerleriyle çizilir (§6.8).
// Geçici (§15.0.6): M3'te getSite().persona'ya bağlanır.
export const OG_COLORS = themeColors(getExperienceProfile('engineer').palette, 'dark');

/** İkonlarda sabit ibre açısı (saat 12'den saat yönünde): küçük boyutta en okunur yön. */
export const ICON_DIAL_ANGLE = 45;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 60 çentikli kadran + yakut ibre (inline <svg>); OG'de 180 px, ikonlarda 32/180 px.
 * 64 px altında yalnız 12 ana çentik çizilir: 60 çentik 32 px'te gri bir lekeye dönüşür.
 * angleDeg saat 12'den saat yönündedir; polar() açıyı +X'ten saat yönü tersine alır.
 */
export function renderDial({ size, angleDeg }: { size: number; angleDeg: number }): ReactElement {
  const c = size / 2;
  const ringW = Math.max(1.5, size * 0.012);
  const R = c - ringW / 2 - Math.max(0.5, size * 0.01);
  const ticks = size >= 64 ? 60 : 12;
  const needleW = Math.max(2, size * 0.02);
  const [nx, ny] = polar(c, c, R * 0.78, 90 - angleDeg);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={c}
        cy={c}
        r={r2(R)}
        fill={OG_COLORS.surface}
        stroke={OG_COLORS.inkMuted}
        strokeWidth={r2(ringW)}
      />
      {Array.from({ length: ticks }, (_, i) => {
        const major = ticks === 12 || i % 5 === 0;
        const deg = 90 - (360 / ticks) * i;
        const inner = R - ringW / 2 - (major ? size * 0.09 : size * 0.045);
        const [x1, y1] = polar(c, c, inner, deg);
        const [x2, y2] = polar(c, c, R - ringW / 2, deg);
        return (
          <line
            key={i}
            x1={r2(x1)}
            y1={r2(y1)}
            x2={r2(x2)}
            y2={r2(y2)}
            stroke={major ? OG_COLORS.inkMuted : OG_COLORS.lineStrong}
            strokeWidth={r2(Math.max(major ? 1 : 0.75, size * (major ? 0.009 : 0.006)))}
          />
        );
      })}
      <line
        x1={c}
        y1={c}
        x2={r2(nx)}
        y2={r2(ny)}
        stroke={OG_COLORS.accent}
        strokeWidth={r2(needleW)}
        strokeLinecap="round"
      />
      <circle cx={c} cy={c} r={r2(needleW * 1.1)} fill={OG_COLORS.accent} />
    </svg>
  );
}
