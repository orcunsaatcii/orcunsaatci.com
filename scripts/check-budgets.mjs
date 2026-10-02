// scripts/check-budgets.mjs — `npm run budgets` (§9.4.2). `next build` SONRASI çalışır. Yalnız node:* kullanır.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const APP_DIR = join(ROOT, '.next/server/app');
const STATIC_DIR = join(ROOT, '.next/static');
const KB = 1024;
const ANALYTICS_RESERVE = 5 * KB; // ⚠️ M9'da ölçülüp güncellenir
const BUDGET = {
  initialJs: 175 * KB - ANALYTICS_RESERVE,
  stage: 300 * KB,
  motion: 60 * KB,
  fonts: { 'MonaSans-trim.woff2': 105 * KB, 'MartianMono-trim.woff2': 26 * KB },
};
const MARKERS = { stage: ['WebGLRenderer'], motion: ['gsapVersions', 'lenis-smooth'] };

const errors = [];
const infos = [];
const kb = (n) => `${(n / KB).toFixed(1)} KB`;
const rel = (p) => relative(ROOT, p);
const gzCache = new Map();
const textCache = new Map();
const gz = (f) =>
  gzCache.has(f)
    ? gzCache.get(f)
    : gzCache.set(f, gzipSync(readFileSync(f), { level: 9 }).length).get(f);
const text = (f) =>
  textCache.has(f) ? textCache.get(f) : textCache.set(f, readFileSync(f, 'utf8')).get(f);
const walk = (dir, ext, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
};
const attrs = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)(?:\s*=\s*"([^"]*)")?/g)].map((m) => [
      m[1].toLowerCase(),
      m[2] ?? '',
    ]),
  );

function initialScripts(html) {
  const urls = new Set();
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const a = attrs(tag);
    if (a.src && !('nomodule' in a)) urls.add(a.src);
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(tag);
    if (a.href && (a.rel === 'modulepreload' || (a.rel === 'preload' && a.as === 'script')))
      urls.add(a.href);
  }
  return [...urls]
    .filter((u) => u.startsWith('/_next/static/'))
    .map((u) =>
      join(STATIC_DIR, decodeURIComponent(u.slice('/_next/static/'.length).split('?')[0])),
    );
}

if (!existsSync(APP_DIR)) {
  console.error('check-budgets: .next/server/app yok. Önce `npm run build` çalıştırın.');
  process.exit(2);
}

// 1–3: route başına ilk JS
const initial = new Set();
const routes = [];
for (const file of walk(APP_DIR, '.html')) {
  const r = relative(APP_DIR, file)
    .split(sep)
    .join('/')
    .replace(/\.html$/, '');
  const route = r === 'index' ? '/' : `/${r}`;
  let total = 0;
  const scripts = initialScripts(text(file));
  for (const s of scripts) {
    if (!existsSync(s)) {
      errors.push(`${route}: HTML'deki ${rel(s)} bulunamadı`);
      continue;
    }
    initial.add(s);
    total += gz(s);
  }
  routes.push({ route, files: scripts.length, initialJs: total, htmlGzip: gz(file) });
  if (total > BUDGET.initialJs)
    errors.push(`${route}: ilk JS ${kb(total)} > ${kb(BUDGET.initialJs)}`);
}

// 4: ilk pakette yasak işaretçiler
for (const f of initial) {
  for (const [group, list] of Object.entries(MARKERS)) {
    for (const m of list)
      if (text(f).includes(m)) errors.push(`ilk pakette ${group} işaretçisi "${m}": ${rel(f)}`);
  }
}

// 5: lazy gruplar (alt sınır)
const lazy = walk(join(STATIC_DIR, 'chunks'), '.js').filter((f) => !initial.has(f));
const groups = {};
for (const [group, list] of Object.entries(MARKERS)) {
  const files = lazy.filter((f) => list.some((m) => text(f).includes(m)));
  const size = files.reduce((n, f) => n + gz(f), 0);
  groups[group] = { files: files.map(rel), gzip: size };
  if (files.length === 0) infos.push(`${group} grubu boş (ilgili milestone öncesi olabilir)`);
  else if (size > BUDGET[group]) errors.push(`${group} grubu ${kb(size)} > ${kb(BUDGET[group])}`);
}

// 6: asset'ler (KOD ile poster yok: statik paneller HTML'dir, §4 KOD)
for (const [name, max] of Object.entries(BUDGET.fonts)) {
  const p = join(ROOT, 'src/fonts', name);
  if (!existsSync(p)) {
    infos.push(`src/fonts/${name} yok (M2 öncesi)`);
    continue;
  }
  const size = statSync(p).size;
  if (size > max) errors.push(`font ${name}: ${kb(size)} > ${kb(max)}`);
}

// 7: rapor
console.table(
  routes.map((r) => ({
    route: r.route,
    'ilk JS (gz)': kb(r.initialJs),
    dosya: r.files,
    'HTML (gz)': kb(r.htmlGzip),
  })),
);
for (const [g, v] of Object.entries(groups))
  console.log(`${g} grubu (alt sınır): ${kb(v.gzip)} · ${v.files.length} dosya`);
writeFileSync(
  join(ROOT, '.next/budgets.json'),
  JSON.stringify({ budget: BUDGET, routes, groups, errors, infos }, null, 2),
);
infos.forEach((m) => console.log(`BİLGİ ${m}`));
if (errors.length) {
  errors.forEach((e) => console.error(`HATA ${e}`));
  process.exit(1);
}
console.log(`check-budgets: OK (${routes.length} route)`);
