// scripts/check-content.ts — site düzeyi içerik doğrulaması (§7.5.2). `content-collections build` SONRASI çalışır.
// Mod: VERCEL_ENV=production ya da --strict → strict; aksi hâlde dev. Her bulgu için "SEVİYE KOD konum — mesaj".
// En az bir `error` varsa exit 1 → build durur. EN açıksa sonda "EN tamlık raporu" bloğu yazılır (§7.4.4 kural 4).
// Göreli import (§8.1): src/lib/content/index.ts `server-only` olduğu için burada kullanılmaz.
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import * as C from '../.content-collections/generated/index.js';
import { MDX_COMPONENTS } from '../src/components/mdx/allowed';
import * as S from '../src/lib/content/schemas';

const STRICT = process.env.VERCEL_ENV === 'production' || process.argv.includes('--strict');
type Level = 'error' | 'warn' | 'info';
const issues: { level: Level; code: string; where: string; msg: string }[] = [];
const report = (level: Level, code: string, where: string, msg: string) =>
  issues.push({ level, code, where, msg });
/** Geliştirmede uyarı, production/--strict'te hata. */
const strictly = (code: string, where: string, msg: string) =>
  report(STRICT ? 'error' : 'warn', code, where, msg);
/** EN tamlık raporu (bilgi; build'i durdurmaz) */
const enReport: string[] = [];

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const LOCALES = C.site.locales as readonly S.Locale[];
const EN = LOCALES.includes('en');
const now = new Date();
const pad2 = (n: number) => String(n).padStart(2, '0');
const TODAY = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`; // yerel build günü
const BUILD_YEAR = now.getFullYear();
/** Kısmi tarihin en erken / en geç günü (dize karşılaştırması için) */
const earliest = (d: string) => (d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d);
const latest = (d: string) => (d.length === 4 ? `${d}-12-31` : d.length === 7 ? `${d}-31` : d);
const words = (s: string) => s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;

type Loc = { tr: string; en?: string };
type LocList = { tr: string[]; en?: string[] };
const isLoc = (v: unknown): v is Loc | LocList =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  'tr' in v &&
  (typeof v.tr === 'string' || Array.isArray(v.tr)) && // site.cv.photo {tr: bool} çevrilebilir metin değildir
  Object.keys(v).every((k) => k === 'tr' || k === 'en');

/** Belge ağacındaki her çevrilebilir alan: [yol, değer]. `_meta`, `content`, `mdx`, `media` atlanır. */
function* locFields(v: unknown, at = ''): Generator<[string, Loc | LocList]> {
  if (isLoc(v)) {
    yield [at, v];
    return;
  }
  if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) yield* locFields(x, `${at}[${i}]`);
    return;
  }
  if (typeof v === 'object' && v !== null) {
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('_') || k === 'content' || k === 'mdx' || k === 'media') continue;
      yield* locFields(x, at ? `${at}.${k}` : k);
    }
  }
}

/** Görsel alanları (src + alt taşıyan nesneler) */
function* images(
  v: unknown,
  at = '',
): Generator<[string, { src: string; alt: Loc; width?: number; height?: number }]> {
  if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) yield* images(x, `${at}[${i}]`);
    return;
  }
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    if (typeof o.src === 'string' && isLoc(o.alt)) {
      yield [at, o as { src: string; alt: Loc; width?: number; height?: number }];
      return;
    }
    for (const [k, x] of Object.entries(o)) {
      if (k.startsWith('_')) continue;
      yield* images(x, at ? `${at}.${k}` : k);
    }
  }
}

/* ── belge envanteri: [dosya, belge] ── */
const projectFile = (slug: string) => `content/projects/${slug}/project.yaml`;
const DOCS: [string, unknown][] = [
  ['content/site/site.yaml', C.site],
  ['content/site/person.yaml', C.person],
  ['content/site/contact.yaml', C.contact],
  ['content/pages/home.yaml', C.home],
  ...C.allAreas.map((a): [string, unknown] => [`content/areas/${a.id}.yaml`, a]),
  ...C.allProjects.map((p): [string, unknown] => [projectFile(p.slug), p]),
  ['content/cv/experience.yaml', C.cvExperience],
  ['content/cv/education.yaml', C.cvEducation],
  ['content/cv/certifications.yaml', C.cvCertifications],
  ['content/cv/awards.yaml', C.cvAwards],
  ['content/cv/publications.yaml', C.cvPublications],
  ['content/cv/skills.yaml', C.cvSkills],
  ['content/cv/languages.yaml', C.cvLanguages],
  ['content/testimonials.yaml', C.testimonials],
];
const BODIES = [
  ...C.allPageBodies.map((b) => ({
    file: `content/pages/${b.key}.${b.locale}.mdx`,
    kind: b.key,
    ...b,
  })),
  ...C.allAreaBodies.map((b) => ({
    file: `content/areas/${b.areaId}.${b.locale}.mdx`,
    kind: 'area' as const,
    ...b,
  })),
];

/* ───────── C01 yer tutucular: ham metin taraması (YAML yorumları ve MDX dahil) ───────── */
const PLACEHOLDER_RE = /\{\{[A-ZÇĞİÖŞÜ0-9_]+\}\}/u; // §0.4.1 kanonik desen (tek kaynak)
const PLACEHOLDER = new RegExp(PLACEHOLDER_RE.source, 'gu');
const RAW: [string, string][] = [];
/** C13: web fontlarının kapsamı (scripts/subset-fonts.sh yazar); kümede olmayan karakter yedek fontla çizilir. */
const COVERAGE = JSON.parse(await readFile('src/fonts/coverage.json', 'utf8')) as Record<
  string,
  number[]
>;
const COVERED = new Set(Object.values(COVERAGE).flat());
const uncovered = new Map<string, string>(); // karakter → ilk görüldüğü yer
for (const root of ['content', 'src/i18n/dictionaries']) {
  for await (const file of walk(root)) {
    // content/README.md sahip kılavuzudur (koleksiyonlara dahil değil, §7.2.1): yer tutucu ve ticari dil
    // kurallarını örnekleriyle anlatır; ham metin taramasına girmez (SPEC-SAPMA §7.5.2)
    if (file === path.join('content', 'README.md')) continue;
    const text = await readFile(file, 'utf8');
    if (root === 'content') RAW.push([file, text]);
    if (!/\.(ya?ml|mdx?|ts)$/.test(file)) continue; // görseller ve PDF'ler metin değildir
    text.split('\n').forEach((line, i) => {
      if (/^\s*(#|\/\/)/.test(line)) return; // YAML/TS yorumları sayfaya çıkmaz
      for (const ch of line)
        if (ch.codePointAt(0)! > 0x7e && !COVERED.has(ch.codePointAt(0)!) && !uncovered.has(ch))
          uncovered.set(ch, `${file}:${i + 1}`);
    });
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(PLACEHOLDER))
        strictly('C01', `${file}:${i + 1}`, `yer tutucu ${m[0]}`);
      if (line.includes('/media/placeholder/'))
        strictly('C01', `${file}:${i + 1}`, 'yer tutucu görsel');
    });
  }
}
for (const [ch, where] of uncovered)
  report(
    'warn',
    'C13',
    where,
    `"${ch}" (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}) web fontlarında yok; yedek fontla çizilir (scripts/subset-fonts.sh U_WEB)`,
  );
for (const a of C.allAreas)
  if (/^alan-\d+$/.test(a.id)) strictly('C01', `content/areas/${a.id}.yaml`, 'tohum alan id');
for (const p of C.allProjects)
  if (/^ornek-proje-\d+$/.test(p.slug))
    strictly('C01', `content/projects/${p.slug}`, 'tohum proje slug');

/* ───────── C02 sayılar (D-37) ───────── */
const N = C.allAreas.length;
if (N === 0) report('error', 'C02', 'content/areas', 'en az 1 alan gerekli');
else if (N < 3 || N > 6)
  report('warn', 'C02', 'content/areas', `N=${N}: Areas liste modunda çizilir (kadran yok)`);
for (const locale of LOCALES) {
  const P = C.allProjects.filter((p) => p.featured && p.locales.includes(locale)).length;
  if (P > 5) report('error', 'C02', `projects (${locale})`, `öne çıkan P=${P} > 5`);
  else if (P < 3) strictly('C02', `projects (${locale})`, `öne çıkan P=${P} < 3`);
}
const E = C.cvExperience.items.filter(
  (e) => e.showOnHome && (e.visibility === 'web-and-pdf' || e.visibility === 'web-only'),
).length;
if (E === 0)
  strictly('C02', 'content/cv/experience.yaml', 'ana sayfada gösterilecek deneyim yok (E=0)');
else if (E > 6)
  report('info', 'C02', 'content/cv/experience.yaml', `E=${E}: ana sayfada en yeni 6 gösterilir`);

/* ───────── C03 benzersizlik ───────── */
function unique<T>(file: string, what: string, values: readonly T[], level: Level = 'error') {
  const seen = new Set<T>();
  for (const v of values) {
    if (seen.has(v)) report(level, 'C03', file, `yinelenen ${what}: ${String(v)}`);
    seen.add(v);
  }
}
unique(
  'content/cv/experience.yaml',
  'id',
  C.cvExperience.items.map((x) => x.id),
);
unique(
  'content/cv/education.yaml',
  'id',
  C.cvEducation.items.map((x) => x.id),
);
unique(
  'content/cv/certifications.yaml',
  'id',
  C.cvCertifications.items.map((x) => x.id),
);
unique(
  'content/cv/awards.yaml',
  'id',
  C.cvAwards.items.map((x) => x.id),
);
unique(
  'content/cv/publications.yaml',
  'id',
  C.cvPublications.items.map((x) => x.id),
);
unique(
  'content/cv/skills.yaml',
  'id',
  C.cvSkills.items.map((x) => x.id),
);
unique(
  'content/cv/languages.yaml',
  'code',
  C.cvLanguages.items.map((x) => x.code),
);
unique(
  'content/testimonials.yaml',
  'id',
  C.testimonials.items.map((x) => x.id),
);
unique(
  'content/areas',
  'order',
  C.allAreas.map((a) => a.order),
);
unique(
  'content/site/contact.yaml',
  'form.topics id',
  C.contact.form.topics.map((x) => x.id),
);
unique(
  'content/projects',
  'order',
  C.allProjects.map((p) => p.order),
  'warn',
);

/* ───────── C04 referanslar (§7.3.5; transform'da denetlenenler hariç) ───────── */
const skillIds = new Set(C.cvSkills.items.map((s) => s.id));
const areaIds = new Set(C.allAreas.map((a) => a.id));
const projectSlugs = new Set(C.allProjects.map((p) => p.slug));
for (const a of C.allAreas)
  for (const s of a.skills)
    if (!skillIds.has(s))
      report('error', 'C04', `content/areas/${a.id}.yaml`, `bilinmeyen yetkinlik "${s}"`);
for (const [i, e] of C.cvExperience.items.entries())
  for (const s of e.skills)
    if (!skillIds.has(s))
      report(
        'error',
        'C04',
        `content/cv/experience.yaml items[${i}]`,
        `bilinmeyen yetkinlik "${s}"`,
      );
for (const [i, s] of C.cvSkills.items.entries())
  for (const a of s.areas)
    if (!areaIds.has(a))
      report('error', 'C04', `content/cv/skills.yaml items[${i}]`, `bilinmeyen alan "${a}"`);
/** Klasör hiç yoksa hata; klasör var ama proje taslaksa uyarı (bağlantı düz metin çizilir). */
function projectRef(where: string, slug: string) {
  if (projectSlugs.has(slug)) return;
  if (existsSync(projectFile(slug)))
    report('warn', 'C04', where, `taslak proje "${slug}": bağlantı düz metin çizilir`);
  else report('error', 'C04', where, `bilinmeyen proje "${slug}"`);
}
for (const [i, e] of C.cvExperience.items.entries())
  for (const s of e.projects) projectRef(`content/cv/experience.yaml items[${i}]`, s);
for (const [i, a] of C.cvAwards.items.entries())
  if (a.project) projectRef(`content/cv/awards.yaml items[${i}]`, a.project);
for (const [i, t] of C.testimonials.items.entries())
  if (t.project) projectRef(`content/testimonials.yaml items[${i}]`, t.project);

/* ───────── C05 medya (§7.5.3) ───────── */
// Oran (±%1) ve en küçük boyut: seviye tabloda verilmez → dev'de uyarı, strict'te hata (SPEC-SAPMA §7.5.2).
const RASTER = /\.(jpe?g|png)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;
const MAX_EDGE = 3200;
const KB = 1024;
type Role = { ratio?: [number, number]; min?: [number, number]; minLong?: number };
const ROLES: Record<string, Role> = {
  portrait: { ratio: [4, 5], min: [1600, 2000] },
  headshot: { ratio: [1, 1], min: [1200, 1200] },
  portraitWorking: { ratio: [3, 2], min: [1800, 1200] },
  cover: { ratio: [16, 10], min: [2400, 1500] },
  mobileCover: { ratio: [4, 5], min: [1200, 1500] },
  preview: { ratio: [4, 3], min: [1200, 900] },
  gallery: { minLong: 1600 },
  figure: { minLong: 1600 },
  avatar: { ratio: [1, 1], min: [400, 400] },
};
function checkRole(where: string, role: string, w: number, h: number) {
  const r = ROLES[role];
  if (!r) return;
  if (r.ratio) {
    const want = r.ratio[0] / r.ratio[1];
    if (Math.abs(w / h - want) / want > 0.01)
      strictly('C05', where, `${role} oranı ${r.ratio.join(':')} olmalı (${w}×${h})`);
  }
  if (r.min && (w < r.min[0] || h < r.min[1]))
    strictly('C05', where, `${role} en az ${r.min.join('×')} px olmalı (${w}×${h})`);
  if (r.minLong && Math.max(w, h) < r.minLong)
    strictly('C05', where, `${role} uzun kenarı en az ${r.minLong} px olmalı (${w}×${h})`);
}
const referenced = new Set<string>();
for (const [file, doc] of DOCS) {
  for (const [at, img] of images(doc)) {
    referenced.add(img.src);
    const role =
      at
        .replace(/\[\d+\]$/, '')
        .split('.')
        .at(-1) ?? '';
    if (img.width && img.height) checkRole(`${file} ${at}`, role, img.width, img.height);
  }
}
for (const b of BODIES)
  for (const [src, m] of Object.entries(b.media)) {
    referenced.add(src);
    checkRole(`${b.file} <Figure src="${src}">`, 'figure', m.width, m.height);
  }
for (const [, doc] of DOCS) {
  // kurum logoları (SVG) da referanstır
  for (const x of (doc as { items?: { logo?: string }[] }).items ?? [])
    if (x.logo) referenced.add(x.logo);
}
if (existsSync('public/media')) {
  for await (const file of walk('public/media')) {
    const src = `/${path.relative('public', file).split(path.sep).join('/')}`;
    if (VIDEO.test(file)) {
      report(
        'error',
        'C05',
        file,
        'video dosyası: site video barındırmaz (D-48); YouTube/Vimeo bağlantısı kullanın',
      );
      continue;
    }
    if (RASTER.test(file)) {
      const input = await readFile(file);
      const meta = await sharp(input).metadata();
      const long = Math.max(meta.autoOrient.width, meta.autoOrient.height);
      if (long > MAX_EDGE) report('error', 'C05', file, `uzun kenar ${long} px > ${MAX_EDGE}`);
      if (input.length > 2 * KB * KB)
        report('error', 'C05', file, `${Math.round(input.length / KB)} KB > 2 MB`);
      else if (input.length > 800 * KB)
        report('warn', 'C05', file, `${Math.round(input.length / KB)} KB > 800 KB`);
    }
    if (!src.startsWith('/media/placeholder/') && !referenced.has(src))
      report('info', 'C05', file, 'hiçbir içerikte referans verilmiyor');
  }
}

/* ───────── C06 EN tamlık (§7.4.4 kural 3–4) ───────── */
if (EN) {
  const CRITICAL: Record<string, RegExp> = {
    'content/site/site.yaml': /^(title|description|cv\.summary)$/,
    'content/site/person.yaml':
      /^(jobTitle|headline|shortBio|location\.(city|country|fromPhrase)|(portrait|headshot|portraitWorking)\.alt)$/,
    'content/site/contact.yaml': /^(responseTime|availability\.note)$/,
    'content/pages/home.yaml':
      /^(about\.lede|about\.paragraphs\[\d+\]|areas\.statement)$|(^|\.)(heading|eyebrow|intro|lead|now)$/,
  };
  const AREA_CRITICAL = /^(title|summary|description)$/;
  const PROJECT_CRITICAL = /^(role|(cover|mobileCover|preview)\.alt)$/;
  for (const [file, doc] of DOCS) {
    const project = C.allProjects.find((p) => projectFile(p.slug) === file);
    if (project && !project.locales.includes('en')) {
      if (Boolean(project.title.en) !== Boolean(project.summary.en))
        strictly(
          'C06',
          file,
          'title.en ve summary.en birlikte olmalı: yalnız biri dolu, EN sayfası üretilmez',
        );
      else enReport.push(`${file} — yalnız TR (EN sayfası yok)`);
      continue;
    }
    const critical = project
      ? PROJECT_CRITICAL
      : file.startsWith('content/areas/')
        ? AREA_CRITICAL
        : (CRITICAL[file] ?? /$^/);
    for (const [at, v] of locFields(doc)) {
      if (v.en !== undefined) continue;
      if (critical.test(at)) strictly('C06', `${file} ${at}.en`, 'EN-kritik alan eksik');
      else enReport.push(`${file} ${at}.en`);
    }
  }
  for (const key of ['about'] as const)
    if (!C.allPageBodies.some((b) => b.key === key && b.locale === 'en'))
      enReport.push(`content/pages/${key}.en.mdx — yok (EN sayfası üretilmez)`);
  for (const a of C.allAreas)
    if (a.hasPage && !a.pageLocales.includes('en'))
      enReport.push(`content/areas/${a.id}.en.mdx — yok (EN alan sayfası üretilmez)`);
}

/* ───────── C07 tutarlılık ───────── */
const hasBody = (key: string, locale: S.Locale) =>
  C.allPageBodies.some((b) => b.key === key && b.locale === locale);
for (const key of ['about', 'privacy'])
  if (!hasBody(key, 'tr')) report('error', 'C07', `content/pages/${key}.tr.mdx`, 'dosya zorunlu');
if (EN && !hasBody('privacy', 'en'))
  strictly('C07', 'content/pages/privacy.en.mdx', 'EN açıkken gizlilik metni zorunlu');
// SPEC-SAPMA §7.5.2 (V-21): EN açıkken about.en.mdx yoksa /en/about build'de notFound() ile JS'siz boş hata kabuğu olur
if (EN && !hasBody('about', 'en'))
  strictly(
    'C07',
    'content/pages/about.en.mdx',
    'EN açıkken hakkımda metni zorunlu (V-21: /en/about boş 404 kabuğu olur)',
  );
{
  const years = C.cvExperience.items.map((e) => Number(e.period.start.slice(0, 4)));
  const start = C.person.careerStartYear ?? (years.length ? Math.min(...years) : undefined);
  if (start === undefined)
    report(
      'error',
      'C07',
      'content/site/person.yaml',
      'careerStartYear çözülemiyor (değer ya da deneyim yok)',
    );
  else if (start < 1950 || start > BUILD_YEAR)
    report(
      'error',
      'C07',
      'content/site/person.yaml',
      `careerStartYear ${start}: 1950–${BUILD_YEAR} dışında`,
    );
}
const primary = C.contact.social.filter((s) => s.primary).length;
if (primary > 4)
  report('error', 'C07', 'content/site/contact.yaml', `birincil sosyal bağlantı ${primary} > 4`);
if (C.site.features.areaPages && !C.allAreas.some((a) => a.hasPage))
  report(
    'warn',
    'C07',
    'content/site/site.yaml',
    'features.areaPages açık ama hasPage: true alan yok',
  );
if (C.site.features.testimonials && C.testimonials.items.length === 0)
  strictly('C07', 'content/site/site.yaml', 'features.testimonials açık ama referans kaydı yok');
for (const l of LOCALES)
  if (C.site.cv.photo[l] && !C.person.headshot && !C.person.portrait)
    report(
      'warn',
      'C07',
      'content/site/site.yaml',
      `cv.photo.${l} açık ama headshot/portrait yok: PDF fotoğrafsız üretilir`,
    );
if (C.site.features.portraitOnHome && !C.person.portrait)
  report('info', 'C07', 'content/site/person.yaml', 'portraitOnHome açık ama portre yok');
const STORE_HOSTS = ['apps.apple.com', 'play.google.com', 'appgallery.huawei.com'];
const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com'];
const hostIn = (url: string, hosts: string[]) => {
  const h = new URL(url).hostname;
  return hosts.some((x) => h === x || h.endsWith(`.${x}`));
};
for (const p of C.allProjects) {
  const file = projectFile(p.slug);
  for (const [i, l] of p.links.entries()) {
    if (l.kind === 'live' && !hostIn(l.url, STORE_HOSTS))
      report(
        'error',
        'C07',
        `${file} links[${i}]`,
        `proje bağlantısı: live yalnız mağaza sayfası (${STORE_HOSTS.join(', ')})`,
      );
    if (l.kind === 'video' && !hostIn(l.url, VIDEO_HOSTS))
      report(
        'error',
        'C07',
        `${file} links[${i}]`,
        `proje bağlantısı: video yalnız ${VIDEO_HOSTS.join(', ')}`,
      );
  }
  if (p.links.filter((l) => l.kind === 'video').length > 1)
    report('error', 'C07', file, 'proje bağlantısı: en fazla 1 video bağlantısı');
}

/* ───────── C08 uzunluk ve üslup (yalnız uyarı) ───────── */
const each = (v: Loc | undefined, fn: (text: string, l: S.Locale) => void) => {
  if (!v) return;
  fn(v.tr, 'tr');
  if (v.en) fn(v.en, 'en');
};
each(C.person.headline, (s, l) => {
  if (words(s) > 18)
    report('warn', 'C08', 'content/site/person.yaml headline', `${l}: ${words(s)} kelime > 18`);
});
C.home.about.paragraphs.forEach((p, i) =>
  each(p, (s, l) => {
    if (words(s) > 60)
      report(
        'warn',
        'C08',
        `content/pages/home.yaml about.paragraphs[${i}]`,
        `${l}: ${words(s)} kelime > 60`,
      );
  }),
);
for (const a of C.allAreas)
  each(a.description, (s, l) => {
    const n = words(s);
    if (n < 60 || n > 100)
      report('warn', 'C08', `content/areas/${a.id}.yaml description`, `${l}: ${n} kelime (60–100)`);
  });
for (const b of BODIES) {
  const [min, max] =
    b.kind === 'about' ? [400, 700] : b.kind === 'area' ? [150, 400] : [0, Infinity];
  const n = words(b.content.replace(/<[^>]*>/g, ' '));
  if (n < min || n > max) report('warn', 'C08', b.file, `gövde ${n} kelime (${min}–${max})`);
}
/** Etkin meta description'lar (§11.2.3): 120–160 karakter */
const descriptions: [string, Loc][] = [
  ['content/site/site.yaml description', C.site.description],
  ...Object.entries(C.site.seo.pages).map(([k, v]): [string, Loc] => [
    `content/site/site.yaml seo.pages.${k}.description`,
    v.description,
  ]),
  ...C.allProjects.map((p): [string, Loc] => [
    `${projectFile(p.slug)} ${p.seo.description ? 'seo.description' : 'summary'}`,
    p.seo.description ?? p.summary,
  ]),
  ...(C.site.features.areaPages
    ? C.allAreas
        .filter((a) => a.hasPage)
        .map((a): [string, Loc] => [
          `content/areas/${a.id}.yaml ${a.seo.description ? 'seo.description' : 'summary'}`,
          a.seo.description ?? a.summary,
        ])
    : []),
];
for (const [where, v] of descriptions)
  each(v, (s, l) => {
    if (l === 'en' && !EN) return;
    if (s.length < 120 || s.length > 160)
      report('warn', 'C08', where, `${l}: meta description ${s.length} karakter (120–160)`);
  });
const ALT_PREFIX = /^(görsel|resim|fotoğraf|image of)\b/iu;
for (const [file, doc] of DOCS)
  for (const [at, img] of images(doc))
    each(img.alt, (s, l) => {
      if (ALT_PREFIX.test(s))
        report(
          'warn',
          'C08',
          `${file} ${at}.alt`,
          `${l}: alt metin "${s.split(' ')[0]}" ile başlamamalı (§7.9.7)`,
        );
    });
for (const b of BODIES)
  for (const [, alt] of b.content.matchAll(/<Figure\b[^>]*\balt="([^"]*)"/g))
    if (alt && ALT_PREFIX.test(alt))
      report('warn', 'C08', b.file, `alt metin "${alt.split(' ')[0]}" ile başlamamalı (§7.9.7)`);
const HOLLOW =
  /tutkulu|yenilikçi|vizyoner|sinerji|360 derece|dünya standartlarında|uçtan uca|passionate|innovative|visionary|\bguru\b|\bninja\b|rockstar|synergy|cutting-edge|world-class/iu;
const SHORT_KEYS = new Set([
  'title',
  'name',
  'role',
  'jobTitle',
  'headline',
  'label',
  'heading',
  'eyebrow',
  'tags',
  'degree',
  'field',
  'value',
]);
const texts = (v: Loc | LocList) => [v.tr, v.en ?? []].flat();
for (const [file, doc] of DOCS)
  for (const [at, v] of locFields(doc))
    for (const s of texts(v)) {
      const m = s.match(HOLLOW);
      if (m) report('warn', 'C08', `${file} ${at}`, `kaçınılacak ifade "${m[0]}" (§7.9.5)`);
      if (/\p{L}'\p{L}/u.test(s))
        report('warn', 'C08', `${file} ${at}`, `kelime içinde düz ' → ’ önerilir`);
      const key =
        at
          .replace(/\[\d+\]/g, '')
          .split('.')
          .at(-1) ?? '';
      if (SHORT_KEYS.has(key) && /\p{Extended_Pictographic}/u.test(s))
        report('warn', 'C08', `${file} ${at}`, 'başlık/kısa alanda emoji');
    }
for (const b of BODIES) {
  const m = b.content.match(HOLLOW);
  if (m) report('warn', 'C08', b.file, `kaçınılacak ifade "${m[0]}" (§7.9.5)`);
  if (/\p{L}'\p{L}/u.test(b.content.replace(/`[^`]*`/g, '')))
    report('warn', 'C08', b.file, `kelime içinde düz ' → ’ önerilir`);
}

/* ───────── C09 ticari dil (D-30, yalnız uyarı) ───────── */
const COMMERCIAL =
  /₺|\bTL\b|fiyat|ücret|paket|indirim|satın al|rezervasyon|randevu al|price|pricing|package|discount|book a call|hire me/iu;
for (const [file, text] of RAW)
  text.split('\n').forEach((line, i) => {
    const m = line.replace(PLACEHOLDER, '').match(COMMERCIAL); // yer tutucu adları C01'in işidir
    if (m) report('warn', 'C09', `${file}:${i + 1}`, `ticari dil "${m[0]}" (D-30, Vercel Hobby)`);
  });

/* ───────── C10 tarih mantığı ───────── */
const future = (where: string, d: string) => {
  if (earliest(d) > TODAY) report('error', 'C10', where, `${d} build tarihinden (${TODAY}) ileri`);
};
for (const p of C.allProjects) {
  future(`${projectFile(p.slug)} publishedAt`, p.publishedAt);
  future(`${projectFile(p.slug)} start`, p.start);
}
for (const [file, list] of [
  ['content/cv/experience.yaml', C.cvExperience.items],
  ['content/cv/education.yaml', C.cvEducation.items],
] as const)
  list.forEach((e, i) => future(`${file} items[${i}].period.start`, e.period.start));
C.cvCertifications.items.forEach((c, i) => {
  if (c.expires && latest(c.expires) < TODAY)
    report(
      'info',
      'C10',
      `content/cv/certifications.yaml items[${i}]`,
      `süresi dolmuş (${c.expires})`,
    );
});

/* ───────── C11 editör için JSON Schema'lar (.schemas/, gitignore) ───────── */
const schemas = {
  site: S.SiteConfig,
  person: S.Person,
  contact: S.Contact,
  home: S.HomePage,
  area: S.Area,
  project: S.Project,
  experience: S.Items(S.Experience),
  education: S.Items(S.Education),
  certifications: S.Items(S.Certification),
  awards: S.Items(S.Award),
  publications: S.Items(S.Publication),
  skills: S.Items(S.Skill),
  languages: S.Items(S.Language),
  testimonials: S.Items(S.Testimonial),
};
await mkdir('.schemas', { recursive: true });
for (const [name, schema] of Object.entries(schemas)) {
  await writeFile(
    `.schemas/${name}.json`,
    JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2),
  );
}

/* ───────── C12 MDX kuralları (§7.7.3) ───────── */
const ALLOWED = new Set<string>(MDX_COMPONENTS);
const testimonialIds = new Set(C.testimonials.items.map((t) => t.id));
for (const [file, text] of RAW) {
  if (!file.endsWith('.mdx')) continue;
  const lines = text.split('\n');
  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = lines.indexOf('---', 1) + 1; // frontmatter atlanır
    if (i === 0) i = lines.length;
  }
  let fence = false;
  const body: string[] = [];
  for (; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const where = `${file}:${i + 1}`;
    if (/^\s*(```|~~~)/.test(raw)) fence = !fence;
    if (fence) continue;
    const line = raw.replace(/`[^`]*`/g, ''); // satır içi kod
    body.push(line);
    if (/^\s*(import|export)\s/.test(line))
      report('error', 'C12', where, 'import/export satırı YASAK');
    if (/^#\s/.test(line)) report('error', 'C12', where, 'H1 (#) YASAK; yalnız ## ve ###');
    if (line.includes('!['))
      report('error', 'C12', where, 'Markdown görseli YASAK; <Figure> kullanın');
    for (const [, tag] of line.matchAll(/<\/?([A-Z][\w.]*)/g))
      if (tag && !ALLOWED.has(tag))
        report('error', 'C12', where, `izin listesi dışı bileşen <${tag}>`);
    const bad = line.match(/<\/?(script|iframe|style|object|embed|form|input)\b/i);
    if (bad) report('error', 'C12', where, `<${bad[1]}> YASAK`);
  }
  for (const [, attrs = ''] of body.join('\n').matchAll(/<Quote\b([^>]*)>/g)) {
    const id = attrs.match(/\btestimonial="([^"]*)"/)?.[1];
    if (id === undefined && !/\bsource=/.test(attrs))
      report('error', 'C12', file, '<Quote>: testimonial ya da source (+ by) gerekli');
    if (id !== undefined && !testimonialIds.has(id))
      report('error', 'C12', file, `<Quote testimonial="${id}">: kayıt yok`);
  }
}

/* ───────── rapor ───────── */
const errors = issues.filter((i) => i.level === 'error');
for (const i of issues) {
  const line = `${i.level.toUpperCase().padEnd(5)} ${i.code} ${i.where} — ${i.msg}`;
  if (i.level === 'error') console.error(line);
  else console.log(line);
}
if (EN) {
  console.log(`\nEN tamlık raporu (${enReport.length} alan; build'i durdurmaz):`);
  for (const line of enReport) console.log(`  ${line}`);
}
console.log(
  `check-content: ${errors.length} hata, ${issues.length - errors.length} uyarı/bilgi (mod: ${STRICT ? 'strict' : 'dev'})`,
);
process.exit(errors.length ? 1 : 0);
