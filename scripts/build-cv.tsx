// scripts/build-cv.tsx — CV PDF'i ve JSON Resume (§7.6.4, §7.6.5). tsx ile çalışır (scripts/package.json: {"type":"module"}).
// Her aktif dil için public/files/{orcun-saatci-cv-<l>.pdf, resume.<l>.json} (gitignore). Route handler'da PDF YASAK.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jsonResume from '@jsonresume/schema'; // CJS: { validate(json, cb) }; tipler scripts/jsonresume.d.ts
import { Font, renderToFile } from '@react-pdf/renderer';
import sharp from 'sharp';
import * as C from '../.content-collections/generated/index.js';
import type { Locale } from '../src/i18n/config';
import { selectCv, toJsonResume, type CvSource } from '../src/lib/content/cv';
import { CvDocument, headerStrings } from './cv-document';

const ROOT = process.cwd();
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.orcunsaatci.com').replace(
  /\/+$/,
  '',
);
const TTF = (f: string) => path.join(ROOT, 'assets/fonts/ttf', f);

Font.register({
  family: 'Mona',
  fonts: [
    { src: TTF('MonaSans-Text.ttf'), fontWeight: 400 },
    { src: TTF('MonaSans-TextSemibold.ttf'), fontWeight: 600 },
  ],
});
Font.register({ family: 'MonaWide', src: TTF('MonaSans-WideBold.ttf'), fontWeight: 700 });
Font.register({ family: 'Martian', src: TTF('MartianMono-Regular.ttf') });
Font.registerHyphenationCallback((word) => [word]); // Türkçe için tireleme kapalı

/** subset-fonts.sh U_TTF aralıklarıyla birebir aynı tutulur (§6.2): U+0020-007E, U+00A0-00FF, İı Ğğ Şş, – —, ‘–”, •, …, →, €, ₺ */
const PDF_CHARSET = /^[\n -~ -ÿİıĞğŞş–—‘-”•…→€₺]*$/u;
const PAGE_RE = /\/Type\s*\/Page(?![s\w])/g;

/** site.cv.photo[locale] açıksa headshot ?? portrait: focal noktasına göre kare, 600×600 JPEG q85 (§7.6.4) */
async function photoFor(locale: Locale): Promise<Buffer | undefined> {
  const img = C.person.headshot ?? C.person.portrait;
  if (!C.site.cv.photo[locale] || !img) return undefined;
  const [fx = 0.5, fy = 0.5] = img.focal ?? [];
  const side = Math.min(img.width, img.height);
  const left = Math.round(Math.min(Math.max(fx * img.width - side / 2, 0), img.width - side));
  const top = Math.round(Math.min(Math.max(fy * img.height - side / 2, 0), img.height - side));
  return sharp(path.join(ROOT, 'public', img.src))
    .autoOrient()
    .extract({ left, top, width: side, height: side })
    .resize(600, 600)
    .jpeg({ quality: 85 })
    .toBuffer();
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

await mkdir(path.join(ROOT, 'public/files'), { recursive: true });
for (const locale of C.site.locales) {
  const src: CvSource = { ...C, projects: C.allProjects };
  const sections = selectCv(src, locale, 'pdf');
  // PDF'e girecek metinler: seçim + başlık bloğu (ad, unvan, iletişim satırı, altbilgi, bölüm başlıkları)
  for (const s of [...collectStrings(sections), ...headerStrings(src, locale)]) {
    const bad = [...s].find((ch) => !PDF_CHARSET.test(ch));
    if (bad) {
      const code = `U+${bad.codePointAt(0)?.toString(16).padStart(4, '0')}`;
      console.error(
        `build-cv: PDF fontunda olmayan karakter ${JSON.stringify(bad)} (${code}, ${locale}): ${JSON.stringify(s)}`,
      );
      process.exit(1);
    }
  }
  const pdf = path.join(ROOT, `public/files/orcun-saatci-cv-${locale}.pdf`);
  const photo = await photoFor(locale);
  await renderToFile(
    <CvDocument locale={locale} sections={sections} src={src} photo={photo} />,
    pdf,
  );
  const pages = ((await readFile(pdf)).toString('latin1').match(PAGE_RE) ?? []).length;
  if (pages > 2) console.warn(`UYARI build-cv: ${locale} PDF ${pages} sayfa (hedef ≤ 2)`);

  const resume = toJsonResume(src, locale, SITE_URL);
  await new Promise<void>((ok, fail) =>
    jsonResume.validate(resume, (err) =>
      err ? fail(new Error(`JSON Resume geçersiz (${locale}): ${JSON.stringify(err)}`)) : ok(),
    ),
  );
  await writeFile(
    path.join(ROOT, `public/files/resume.${locale}.json`),
    `${JSON.stringify(resume, null, 2)}\n`,
  );
  console.log(
    `build-cv: ${locale} → ${pages} sayfa, ${(await stat(pdf)).size} bayt${photo ? ', fotoğraflı' : ''}`,
  );
}
