// src/lib/seo/og.tsx — OG ve ikon görsellerinin ortak render modülü (§11.5.3). Yerleşim, tipografi ve kesit motifi
// §6.8'dedir (SPEC-SAPMA §11.5.3: §11.5 görsel şablonun sahibini §6.8 sayar; başlık sütunu 760/520 px, boyutlar
// 76/60/48 ve 220 px kesit motifi oradan). Yalnız görsel route'ları ve icon.tsx / apple-icon.tsx import eder.
import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';
import sharp from 'sharp';
import { themeColors } from '@/design/tokens';
import { getExperienceProfile } from '@/experience/profile';
import { SITE_URL, type Locale } from '@/i18n/config';
import { upper } from '@/i18n/format';
import { getSite } from '@/lib/content';
import {
  arcFraction,
  arcPath,
  polar,
  ringRadius,
  sectorOffsetDeg,
  sectorPath,
} from '@/lib/section-geometry';
import { clampText } from './metadata';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_SAFE = 64; // güvenli alan (px), §6.8
export const OG_COVER_BOX = { width: 504, height: 502 } as const; // proje varyantı: x 632–1136, y 64–566 (§6.8)
const TITLE_COLUMN = { home: 760, project: 520 } as const; // §6.8
/** Alt satırdaki alan adı: kanonik kökenden (www. öneksiz) */
const DOMAIN = new URL(SITE_URL).host.replace(/^www\./, '');

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
export const OG_COLORS = themeColors(getExperienceProfile(getSite().persona).palette, 'dark');

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

/* ───────────── OG (§6.8, §11.5.3) ───────────── */

/** Eyebrow parçası; her parça kendi diline göre büyütülür. */
export interface OgSegment {
  text: string;
  lang: Locale;
}

/** Kesit motifi verisi: section-geometry'den (§5.10); açık yay build tarihine göre. */
export interface OgMotif {
  rings: number;
  sectors: number; // 0 → dilim çizilmez (liste modu)
  band?: readonly [number, number] | null; // proje varyantı: projenin bandı
  sector?: number | null; // proje varyantı: birincil alanın dilimi
}

export interface OgInput {
  locale: Locale;
  variant: 'home' | 'project' | 'cv';
  eyebrow: OgSegment[]; // ' · ' ile birleşir → "PROJE · 2025"
  title: string; // karışık harf; asla büyütülmez
  subtitle?: string; // tek satır; clampText(…, 70)
  footerRight: string; // "Orçun Saatçi · Bilgisayar Mühendisi ve Mobil Uygulama Geliştiricisi"
  seed: string; // 'home' | 'project:<slug>' | 'cv'
  motif: OgMotif;
  cover?: string | null; // data:image/jpeg;base64,… (yalnız project)
}

/** FNV-1a 32 bit → 0–359°. Aynı sayfa her build'de aynı açıyı alır. */
export function angleFor(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 360;
}

/**
 * Başlık sığdırma (Satori metin ölçemez; §6.8 eşikleri, 0.522 em/karakter, %85 doluluk):
 * sütun 760 → ≤ 32: 76, ≤ 41: 60, değilse 48 + kelime sınırında "…" (en çok 52);
 * sütun 520 → ≤ 22: 76, ≤ 28: 60, değilse 48 + "…" (en çok 36).
 */
export function fitTitle(text: string, column: number): { fontSize: 76 | 60 | 48; text: string } {
  const narrow = column <= TITLE_COLUMN.project;
  const [t76, t60, max48] = narrow ? [22, 28, 36] : [32, 41, 52];
  const clean = text.normalize('NFC').trim();
  if (clean.length <= t76) return { fontSize: 76, text: clean };
  if (clean.length <= t60) return { fontSize: 60, text: clean };
  return { fontSize: 48, text: clampText(clean, max48) };
}

/** Kapak → OG kutusu boyutunda JPEG data URI. SVG kapak veya eksik dosya → null (varyant kapaksız çizilir). */
export async function coverDataUri(publicSrc: string, box = OG_COVER_BOX): Promise<string | null> {
  if (/\.svg$/i.test(publicSrc)) return null;
  const input = await readFile(join(process.cwd(), 'public', publicSrc)).catch(() => null);
  if (!input) return null;
  let quality = 80;
  let out = await sharp(input)
    .resize(box.width, box.height, { fit: 'cover' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  while (out.byteLength > 150_000 && quality > 50) {
    quality -= 10;
    out = await sharp(input)
      .resize(box.width, box.height, { fit: 'cover' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }
  return `data:image/jpeg;base64,${out.toString('base64')}`;
}

/**
 * Kesit motifi (§6.8): surface disk; halka ve dilim çizgileri ink-muted 1.5 px; bugüne kadar açık yay accent 3 px.
 * Proje varyantında projenin bandı (iki halka) ve dilimi aksanla yanar.
 */
export function renderSection({ size, motif }: { size: number; motif: OgMotif }): ReactElement {
  const c = size / 2;
  const stroke = size >= 120 ? 1.5 : 1;
  const arcW = size >= 120 ? 3 : 2;
  const R = c - arcW;
  const n = motif.sectors;
  const rings = Array.from({ length: motif.rings }, (_, i) => ringRadius(i, motif.rings, R));
  const band = motif.band ?? null;
  const bandRadii =
    band && band[0] >= 0
      ? [ringRadius(band[0] - 1, motif.rings, R), ringRadius(band[1], motif.rings, R)].map((r) =>
          Math.max(r, 0),
        )
      : null;
  const arc = arcPath(arcFraction(new Date()), R + arcW / 2, R - arcW / 2, c, c); // build tarihi
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r2(R)} fill={OG_COLORS.surface} />
      {motif.sector != null && n > 0 ? (
        <path d={sectorPath(motif.sector, n, R, c, c)} fill={OG_COLORS.accent} fillOpacity={0.5} />
      ) : null}
      {rings.map((r, i) => (
        <circle
          key={`r${i}`}
          cx={c}
          cy={c}
          r={r2(r)}
          fill="none"
          stroke={OG_COLORS.inkMuted}
          strokeWidth={stroke}
          strokeOpacity={i === rings.length - 1 ? 1 : 0.55}
        />
      ))}
      {n > 0
        ? Array.from({ length: n }, (_, k) => {
            const [x, y] = polar(c, c, R, sectorOffsetDeg(n) + (k * 360) / n);
            return (
              <line
                key={`s${k}`}
                x1={c}
                y1={c}
                x2={r2(x)}
                y2={r2(y)}
                stroke={OG_COLORS.inkMuted}
                strokeWidth={stroke}
              />
            );
          })
        : null}
      {bandRadii
        ? bandRadii.map((r, i) => (
            <circle
              key={`b${i}`}
              cx={c}
              cy={c}
              r={r2(r)}
              fill="none"
              stroke={OG_COLORS.accent}
              strokeWidth={stroke + 0.5}
            />
          ))
        : null}
      {arc ? <path d={arc} fill={OG_COLORS.accent} /> : null}
    </svg>
  );
}

export async function renderOg(input: OgInput): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  const eyebrow = input.eyebrow.map((s) => upper(s.text, s.lang)).join(' · ');
  const withCover = input.variant === 'project' && Boolean(input.cover);
  const title = fitTitle(input.title, withCover ? TITLE_COLUMN.project : TITLE_COLUMN.home);
  const subtitle = input.subtitle ? clampText(input.subtitle, 70) : undefined;
  const C = OG_COLORS;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: C.canvas,
        color: C.ink,
      }}
    >
      {/* eyebrow, başlık, alt başlık: x 64, y 64 / 128 */}
      <div
        style={{
          position: 'absolute',
          left: OG_SAFE,
          top: OG_SAFE,
          width: withCover ? TITLE_COLUMN.project : TITLE_COLUMN.home,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'MartianMono',
            fontSize: 22,
            letterSpacing: '0.08em',
            color: C.inkMuted,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 128 - OG_SAFE - 22 * 1.4,
            fontFamily: 'MonaWide',
            fontSize: title.fontSize,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: C.ink,
          }}
        >
          {title.text}
        </div>
        {subtitle ? (
          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontFamily: 'MonaText',
              fontSize: 30,
              lineHeight: 1.3,
              color: C.inkMuted,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {/* sağ: kesit motifi (220 px, x 916–1136) ya da kapak (x 632–1136, y 64–566) */}
      {withCover && input.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori <img> ister; next/image yok
        <img
          src={input.cover}
          width={OG_COVER_BOX.width}
          height={OG_COVER_BOX.height}
          alt=""
          style={{
            position: 'absolute',
            left: 632,
            top: OG_SAFE,
            borderRadius: 6,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{ position: 'absolute', left: 916, top: OG_SAFE, display: 'flex' }}>
          {renderSection({ size: 220, motif: input.motif })}
        </div>
      )}
      {/* 1 px kural çizgisi, y 518 */}
      <div
        style={{
          position: 'absolute',
          left: OG_SAFE,
          top: 518,
          width: OG_SIZE.width - 2 * OG_SAFE,
          height: 1,
          background: C.line,
          display: 'flex',
        }}
      />
      {/* alt satır: URL (x 64, y 538) ← → ad · unvan (sağa dayalı, y 534) */}
      <div
        style={{
          position: 'absolute',
          left: OG_SAFE,
          top: 534,
          width: OG_SIZE.width - 2 * OG_SAFE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {withCover ? (
            <div style={{ display: 'flex', marginRight: 16 }}>
              {renderSection({ size: 64, motif: input.motif })}
            </div>
          ) : null}
          <div
            style={{ display: 'flex', fontFamily: 'MartianMono', fontSize: 22, color: C.inkMuted }}
          >
            {DOMAIN}
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: 'MonaText', fontSize: 24, color: C.ink }}>
          {input.footerRight}
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts },
  );
}
