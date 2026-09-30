// scripts/render-posters.ts — poster hattı (§5.16.3, D-31). Yalnız yerelde çalışır; CI poster üretmez.
// Kullanım (yerel):
//   NEXT_PUBLIC_ENABLE_LAB=1 npm run build && NEXT_PUBLIC_ENABLE_LAB=1 npm start   (ayrı terminal)
//   npm run posters            → 36 dosyayı üretir
//   npm run posters -- --check → varlık + bütçe denetimi (yerel; CI'da aynı denetimi check-budgets.mjs yapar, §9.4.2, §13.6.1)
//   npm run posters -- --qa    → 13 anahtar × 2 tema PNG'yi .lab-out/'a yazar (gitignore; görsel QA ızgarası)
// SPEC-SAPMA: §5.16.3 — package.json "type": "module" taşımadığı için tsx dosyayı CommonJS olarak çalıştırır ve
// üst düzey await kullanılamaz; akış aynı sırayla main() içine alındı.
import { mkdir, stat } from 'node:fs/promises';
import { chromium, type Page } from '@playwright/test';
import sharp, { type OverlayOptions } from 'sharp';
import { palettes } from '../src/design/tokens';
import { KEYFRAME_KEYS, KEYFRAME_LABEL, type KeyframeKey } from '../src/stage/keyframes';

const KEYS = [
  { key: 'hero', file: 'k0' },
  { key: 'about-half', file: 'k1' },
  { key: 'contact-ring', file: 'k5' },
] as const;
const THEMES = ['light', 'dark'] as const;
const SIZES = [640, 1080, 1600] as const;
const BASE = process.env.POSTER_BASE_URL ?? 'http://localhost:3000';
const AVIF_1080_MAX = 40 * 1024;
const AVIF_QUALITY = 50;
const AVIF_QUALITY_FALLBACK = 40; // 1080 AVIF 40 KB'ı aşarsa (§5.16.3)
const RENDER_SIZE = 1600;
const QA_DIR = '.lab-out';
const QA_TILE = 400;
/** Görünür içeriğin kare kenarına asgari uzaklığı (1600 px'te %1): poster kırpılmamalı */
const QA_MIN_MARGIN = 16;
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

type Theme = (typeof THEMES)[number];
type LabWindow = Window & { __stageReady?: boolean; __stageError?: string };

async function check(): Promise<void> {
  for (const k of KEYS)
    for (const t of THEMES)
      for (const w of SIZES)
        for (const ext of ['avif', 'webp']) {
          const f = `public/stage/${k.file}-${t}-${w}.${ext}`;
          const s = await stat(f).catch(() => null);
          if (!s) throw new Error(`Eksik poster: ${f}`);
          if (ext === 'avif' && w === 1080 && s.size > AVIF_1080_MAX)
            throw new Error(`Bütçe aşıldı: ${f} ${s.size} B`);
        }
  console.log('posters --check: 36 dosya var, *-1080.avif ≤ 40 KB');
}

/** /lab/stage'i açar, hazır olmasını bekler ve canvas piksellerini alfa ile PNG olarak döndürür. */
async function capture(page: Page, key: KeyframeKey, theme: Theme): Promise<Buffer> {
  const errors: string[] = [];
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  page.on('console', onConsole);
  try {
    await page.goto(`${BASE}/lab/stage?key=${key}&theme=${theme}&size=${RENDER_SIZE}`);
    await page.waitForFunction(
      () => {
        const w = window as LabWindow;
        return w.__stageReady === true || typeof w.__stageError === 'string';
      },
      null,
      { timeout: 60_000 },
    );
    const failure = await page.evaluate(() => (window as LabWindow).__stageError ?? null);
    if (failure) throw new Error(`${key}/${theme}: ${failure}`);
    if (errors.length) throw new Error(`${key}/${theme}: konsol hatası: ${errors.join(' | ')}`);
    // Birincil yol toDataURL (preserveDrawingBuffer); şeffaflık sayfa zeminine bağlı kalmaz (§5.16.3)
    const dataUrl = await page.evaluate(() =>
      document.querySelector<HTMLCanvasElement>('#lab-canvas canvas')!.toDataURL('image/png'),
    );
    return Buffer.from(dataUrl.split(',')[1]!, 'base64');
  } finally {
    page.off('console', onConsole);
  }
}

async function encodePosters(file: string, theme: Theme, png: Buffer): Promise<void> {
  const write = async (quality: number) => {
    for (const w of SIZES) {
      const img = sharp(png).resize(w, w, { kernel: 'lanczos3' });
      await img
        .clone()
        .avif({ quality, effort: 6 })
        .toFile(`public/stage/${file}-${theme}-${w}.avif`);
      await img
        .clone()
        .webp({ quality: 80, alphaQuality: 90 })
        .toFile(`public/stage/${file}-${theme}-${w}.webp`);
    }
    return (await stat(`public/stage/${file}-${theme}-1080.avif`)).size;
  };
  let size = await write(AVIF_QUALITY);
  if (size > AVIF_1080_MAX) size = await write(AVIF_QUALITY_FALLBACK);
  console.log(`${file}-${theme}: 1080.avif ${(size / 1024).toFixed(1)} KB`);
}

/**
 * Tek geçişte piksel denetimi (§5.19):
 * - black: opak ve (neredeyse) siyah pikseller → NaN ya da bozuk gölgelendirme belirtisi;
 * - margin: görünür (alfa > 3) içeriğin kareye en yakın kenar mesafesi, px → kırpılma denetimi.
 */
async function inspect(png: Buffer): Promise<{ black: number; margin: number }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let black = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const a = data[i + 3]!;
      if (a === 255 && Math.max(data[i]!, data[i + 1]!, data[i + 2]!) <= 2) black++;
      if (a > 3) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const margin = x1 < 0 ? 0 : Math.min(x0, y0, width - 1 - x1, height - 1 - y1);
  return { black, margin };
}

async function qa(page: Page): Promise<void> {
  await mkdir(QA_DIR, { recursive: true });
  const report: { anahtar: string; 'siyah/NaN piksel': number; 'kenar payı px': number }[] = [];
  for (const theme of THEMES) {
    const canvas = palettes.mekanizma[theme].canvas; // sayfa zemini: ziyaretçinin gördüğü bileşim
    const tiles: OverlayOptions[] = [];
    for (const [i, key] of KEYFRAME_KEYS.entries()) {
      const png = await capture(page, key, theme);
      const name = `${KEYFRAME_LABEL[key]}-${key}-${theme}`;
      await sharp(png).flatten({ background: canvas }).png().toFile(`${QA_DIR}/${name}.png`);
      const { black, margin } = await inspect(png);
      report.push({ anahtar: name, 'siyah/NaN piksel': black, 'kenar payı px': margin });
      tiles.push({
        input: await sharp(png).resize(QA_TILE, QA_TILE).png().toBuffer(),
        left: (i % 5) * QA_TILE,
        top: Math.floor(i / 5) * QA_TILE,
      });
    }
    await sharp({
      create: { width: 5 * QA_TILE, height: 3 * QA_TILE, channels: 4, background: canvas },
    })
      .composite(tiles)
      .png()
      .toFile(`${QA_DIR}/grid-${theme}.png`);
  }
  console.table(report);
  const black = report.filter((r) => r['siyah/NaN piksel'] > 0).map((r) => r.anahtar);
  if (black.length) throw new Error(`QA: siyah/NaN piksel bulundu: ${black.join(', ')}`);
  const cropped = report.filter((r) => r['kenar payı px'] < QA_MIN_MARGIN).map((r) => r.anahtar);
  if (cropped.length)
    throw new Error(`QA: kırpılma riski (kenar payı < ${QA_MIN_MARGIN} px): ${cropped.join(', ')}`);
  console.log(`posters --qa: ${report.length} PNG ve 2 ızgara ${QA_DIR}/ altında`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--check')) return check();

  const browser = await chromium.launch({ args: SWIFTSHADER });
  try {
    const page = await browser.newPage({
      viewport: { width: RENDER_SIZE, height: RENDER_SIZE },
      deviceScaleFactor: 1,
    });
    if (process.argv.includes('--qa')) return await qa(page);
    await mkdir('public/stage', { recursive: true });
    for (const k of KEYS)
      for (const theme of THEMES)
        await encodePosters(k.file, theme, await capture(page, k.key, theme));
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
