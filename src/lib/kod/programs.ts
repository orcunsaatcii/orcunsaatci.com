// src/lib/kod/programs.ts — KOD programları (§4 KOD): içerikten türeyen veriyi 56 × 24'lük ekran tamponuna yazan saf
// fonksiyonlar. Sunucu son kareyi (age büyük, reduce) statik HTML panele çizer; istemci her karede WebGL ızgarasına.
// Okunurluk kuralı: her program bir bakışta kod ya da diyagram olarak okunur; yalnız içerikteki olgular yazılır.
import { ROLE, Screen, textLen, type Role } from './screen';
import { tokenize, writeTokens } from './syntax';
import type { KodArea, KodData, KodEntry, KodProgram, KodProject } from './types';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** n kod noktasına sığdırır (taşarsa "…") */
export function fit(s: string, n: number): string {
  const cs = [...s];
  return cs.length <= n ? s : `${cs.slice(0, Math.max(0, n - 1)).join('')}…`;
}
/** Dart dizesi: tek tırnak kaçışlanır */
const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const L = {
  tr: {
    about: '// Hakkımda',
    notFound: 'sayfa bulunamadı',
    suggest: '# Önerilen:',
    items: (n: number) => `${n} öğe`,
  },
  en: {
    about: '// About',
    notFound: 'page not found',
    suggest: '# Try:',
    items: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  },
} as const;

/** Negatif sayıda da [0, n) aralığında mod */
const mod = (a: number, n: number) => ((a % n) + n) % n;

interface Ctx {
  s: Screen;
  d: KodData;
  age: number;
  reduce: boolean;
}

/* ───────── pencere çerçevesi ───────── */

export function chrome(s: Screen, title: string, left: string, right: string): void {
  const C = s.cols,
    R = s.rows,
    A = 0.75;
  s.put(0, 0, `╭${'─'.repeat(C - 2)}╮`, ROLE.muted, A);
  for (let y = 1; y < R - 1; y++) {
    s.put(0, y, '│', ROLE.muted, A);
    s.put(C - 1, y, '│', ROLE.muted, A);
  }
  s.put(0, R - 1, `╰${'─'.repeat(C - 2)}╯`, ROLE.muted, A);
  s.put(2, 0, ' ', ROLE.muted, A);
  s.put(3, 0, '●', ROLE.accent, 0.9);
  s.put(4, 0, ' ', ROLE.muted, A);
  s.put(5, 0, '●', ROLE.brass, 0.9);
  s.put(6, 0, ' ', ROLE.muted, A);
  s.put(7, 0, '●', ROLE.muted, 0.7);
  s.put(8, 0, ' ', ROLE.muted, A);
  if (title) s.put(10, 0, ` ${fit(title, C - 14)} `, ROLE.ink, 0.92);
  if (left) s.put(2, R - 1, ` ${fit(left, 26)} `, ROLE.muted, 0.85);
  if (right) s.put(C - 4 - textLen(right), R - 1, ` ${right} `, ROLE.muted, 0.85);
}

const lineNo = (s: Screen, n: number, y: number, a = 0.45) =>
  s.put(1, y, String(n).padStart(3), ROLE.subtle, a);

/** İmleç: zemin vurgusu; reduce'da sabit açık */
function cursor(c: Ctx, x: number, y: number): void {
  const { s } = c;
  if (x < 1 || x >= s.cols - 1) return;
  if (c.reduce || c.age % 1.06 < 0.6) s.bg(x, y, x, y, ROLE.accent, 0.9);
}

/* ───────── giriş: main.dart ───────── */

function heroSource(d: KodData): string[] {
  const W = 50;
  return [
    "import 'package:flutter/material.dart';",
    '',
    'void main() => runApp(const Portfolio());',
    '',
    'class Portfolio extends StatelessWidget {',
    '  const Portfolio({super.key});',
    '',
    '  @override',
    '  Widget build(BuildContext context) {',
    '    return const Profile(',
    fit(`      city: ${q(d.city)},`, W),
    fit(`      subtitle: ${q(d.title)},`, W),
    fit(`      child: Text(${q(d.name)}),`, W),
    '    );',
    '  }',
    '}',
  ];
}

function rHero(c: Ctx): void {
  const { s } = c;
  const src = heroSource(c.d);
  const at = 12; // ad satırı
  chrome(s, 'main.dart', 'dart · utf-8', `Ln ${at + 1}, Col ${textLen(src[at] ?? '') + 1}`);
  src.forEach((l, k) => {
    lineNo(s, k + 1, k + 1, k === at ? 0.9 : 0.45);
    writeTokens(s, 5, k + 1, tokenize(l));
  });
  s.bg(4, at + 1, s.cols - 2, at + 1, ROLE.accent, 0.07);
  cursor(c, 5 + textLen(src[at] ?? ''), at + 1);
}

/* ───────── hakkımda: about.dart (bloklar sırayla) ───────── */

/** Dize listesini ~W sütunluk satırlara böler: ["  'a', 'b',", …]; tek öğe satıra sığmazsa "…" ile kısalır */
function wrapList(items: readonly string[], indent: number, W: number): string[] {
  const out: string[] = [];
  let cur = ' '.repeat(indent);
  for (const it of items) {
    const piece = `${q(fit(it, W - indent - 3))},`; // tırnaklar + virgül
    if (textLen(cur) + textLen(piece) + 1 > W && cur.trim()) {
      out.push(cur.trimEnd());
      cur = ' '.repeat(indent);
    }
    cur += (cur.trim() ? ' ' : '') + piece;
  }
  if (cur.trim()) out.push(cur.trimEnd());
  return out;
}

export function aboutBlocks(d: KodData): string[][] {
  const W = 50;
  const head = [
    L[d.locale].about,
    fit(`const ${d.varName} = Developer(`, W),
    fit(`  name: ${q(d.name)},`, W),
    fit(`  title: ${q(d.title)},`, W),
    fit(`  city: ${q(d.city)},`, W),
    ...(d.since ? [`  since: ${d.since},`] : []),
  ];
  const areas = d.areas.length
    ? ['  areas: [', ...d.areas.map((a) => fit(`    ${q(a.title)},`, W)), '  ],']
    : [];
  const skillLines = wrapList(d.skills, 4, W).slice(0, 6);
  const skills = d.skills.length ? ['  skills: [', ...skillLines, '  ],'] : [];
  const tail = [...(d.now ? [fit(`  now: ${q(d.now)},`, W)] : []), ');'];
  return [head, areas, skills, tail].filter((b) => b.length > 0);
}

function rAbout(c: Ctx, reveal: number): void {
  const { s, d } = c;
  const blocks = aboutBlocks(d);
  const shown = Math.max(1, Math.min(blocks.length, Math.ceil(reveal * blocks.length - 1e-6)));
  chrome(s, 'about.dart', 'dart · utf-8', `${shown}/${blocks.length}`);
  let y = 1;
  let cur: [number, number] | null = null;
  blocks.forEach((b, k) => {
    if (k >= shown) return;
    const on = k === shown - 1 && shown < blocks.length;
    // açılış sürerken önceki bloklar sönük, son açılan vurgulu; dosya tamamken hepsi tam opak
    const dim = shown < blocks.length && !on;
    for (const l of b) {
      if (y > s.rows - 2) return;
      lineNo(s, y, y, on ? 0.9 : 0.45);
      writeTokens(s, 5, y, tokenize(l), dim ? 0.55 : 1, on ? 1 : 0);
      if (on) {
        s.put(4, y, '┃', ROLE.accent, 1);
        cur = [5 + textLen(l), y];
      }
      y++;
    }
  });
  if (cur) cursor(c, cur[0], cur[1]);
  else if (y <= s.rows - 2) cursor(c, 5, y - 1 >= 1 ? y : 1);
}

/* ───────── çalışma alanları: alan başına diyagram ───────── */

function box(s: Screen, x: number, y: number, w: number, label: string, role: Role, a = 1): void {
  s.put(x, y, `╭${'─'.repeat(w - 2)}╮`, role, a);
  for (let k = 1; k <= 2; k++) {
    s.put(x, y + k, '│', role, a);
    s.put(x + w - 1, y + k, '│', role, a);
  }
  s.put(x, y + 3, `╰${'─'.repeat(w - 2)}╯`, role, a);
  if (label) s.put(x + Math.floor((w - textLen(label)) / 2), y + 1, label, ROLE.ink, 1);
}

const find = (tags: readonly string[], re: RegExp) => tags.filter((t) => re.test(t));

function figPhone(c: Ctx, a: KodArea): void {
  const { s } = c;
  s.put(2, 1, `// ${fit(a.title, 50)}`, ROLE.subtle);
  const x0 = 6,
    y0 = 3,
    w = 18,
    h = 19,
    X1 = x0 + w - 1,
    Y1 = y0 + h - 1,
    I = 0.9;
  s.put(x0, y0, `╭${'─'.repeat(w - 2)}╮`, ROLE.ink, I);
  for (let y = y0 + 1; y < Y1; y++) {
    s.put(x0, y, '│', ROLE.ink, I);
    s.put(X1, y, '│', ROLE.ink, I);
  }
  s.put(x0, Y1, `╰${'─'.repeat(w - 2)}╯`, ROLE.ink, I);
  s.put(x0 + 6, y0 + 1, '━━━━━━', ROLE.ink, 0.85); // dinamik ada
  s.bg(x0 + 2, y0 + 3, X1 - 2, y0 + 5, ROLE.accent, 0.92); // başlık kartı
  s.put(x0 + 3, y0 + 4, '━━━━━━━', ROLE.panel, 1);
  s.put(X1 - 5, y0 + 4, '━━', ROLE.panel, 0.75);
  const k0 = c.reduce ? 0 : Math.floor(c.age / 1.5); // liste satırları kayar
  for (let r = 0; r < 4; r++) {
    const y = y0 + 7 + r * 2,
      n = r + k0,
      l = 4 + Math.floor(hash(n * 3.1) * 5),
      m = 2 + Math.floor(hash(n * 7.7) * 2);
    s.put(x0 + 2, y, '●', [ROLE.accent, ROLE.brass, ROLE.muted][n % 3] ?? ROLE.muted, 0.9);
    s.put(x0 + 4, y, '━'.repeat(l), ROLE.ink, 0.72);
    s.put(X1 - 1 - m, y, '━'.repeat(m), ROLE.muted, 0.55);
  }
  s.put(x0 + 2, Y1 - 3, '─'.repeat(w - 4), ROLE.muted, 0.4);
  s.put(x0 + 3, Y1 - 2, '●   ○   ○   ○', ROLE.muted, 0.85); // sekme çubuğu
  s.put(x0 + 6, Y1 - 1, '━━━━━━', ROLE.ink, 0.6);
  // sağda etiketler: ilk iki etiket, sonra platform dalları, sonuncusu not
  const [t0, t1, ...rest] = a.tags;
  const branches = rest.slice(0, rest.length > 2 ? 2 : rest.length);
  const note = rest.length > 2 ? rest[2] : undefined;
  if (t0) {
    s.put(26, 8, '←──', ROLE.muted, 0.7);
    s.put(30, 8, fit(t1 ? `${t0} · ${t1}` : t0, 24), ROLE.ink);
  }
  branches.forEach((b, k) => {
    const last = k === branches.length - 1;
    s.put(30, 9 + k, last ? '└─→' : '├─→', ROLE.muted, 0.7);
    s.put(34, 9 + k, fit(b, 20), ROLE.ink);
  });
  if (note) s.put(30, 10 + branches.length, fit(note, 24), ROLE.subtle);
}

function figTree(c: Ctx, a: KodArea): void {
  const { s } = c;
  s.put(2, 1, `// ${fit(a.title, 50)}`, ROLE.subtle);
  s.put(2, 3, '$', ROLE.accent);
  s.put(4, 3, 'tree lib', ROLE.ink);
  s.bg(3, 7, s.cols - 4, 8, ROLE.accent, 0.08);
  s.bg(3, 10, s.cols - 4, 10, ROLE.brass, 0.11);
  s.bg(3, 12, s.cols - 4, 12, ROLE.muted, 0.1);
  s.put(4, 5, 'lib/', ROLE.ink);
  for (const y of [6, 9, 11]) s.put(4, y, '│', ROLE.muted, 0.7);
  const tags = a.tags;
  const used = new Set<string>();
  const pick = (re: RegExp) => {
    const hit = find(tags, re).filter((t) => !used.has(t));
    hit.forEach((t) => used.add(t));
    return hit;
  };
  const pres = pick(/mvvm|mvc|ui|widget|material/i);
  const state = pick(/riverpod|bloc|provider|redux|state|getx/i);
  const domain = pick(/architecture|clean|ddd|domain/i);
  const data = pick(/rest|soap|api|data|sql|http|graphql/i);
  const restTags = tags.filter((t) => !used.has(t));
  const note = (xs: string[]) => (xs.length ? `# ${xs.join(' · ')}` : '');
  const rows: Array<[number, string, string, string, Role]> = [
    [7, '├── ', 'presentation/', note(pres.length ? pres : restTags.splice(0, 1)), ROLE.accent],
    [8, '│   └── ', 'state/', note(state), ROLE.accent],
    [10, '├── ', 'domain/', note(domain.length ? domain : restTags.splice(0, 1)), ROLE.brass],
    [12, '└── ', 'data/', note(data.length ? data : restTags.splice(0, 1)), ROLE.muted],
  ];
  for (const [y, br, dir, nt, role] of rows) {
    const x = s.put(4, y, br, ROLE.muted, 0.7);
    s.put(x, y, dir, ROLE.ink);
    if (nt) s.put(28, y, fit(nt, 26), role);
  }
}

function figApi(c: Ctx, a: KodArea): void {
  const { s } = c;
  s.put(2, 1, `// ${fit(a.title, 50)}`, ROLE.subtle);
  const y = 3,
    ax = 3,
    bx = 45,
    w = 8,
    x0 = ax + w + 1,
    x1 = bx - 2;
  box(s, ax, y, w, 'App', ROLE.ink, 0.85);
  box(s, bx, y, w, 'API', ROLE.ink, 0.85);
  // protokol adları yalnız etiketlerden (içerikte yoksa protokolsüz istek, §4.1.2)
  const types = find(a.tags, /^(rest|soap|graphql|grpc)$/i);
  const A = c.reduce ? 0 : c.age;
  const ph = (A % 2.4) / 2.4;
  const kind = types.length ? (types[mod(Math.floor(A / 2.4), types.length)] ?? '') : '';
  const req = `${/soap/i.test(kind) ? 'POST' : 'GET'} /invoices${kind ? ` · ${kind}` : ''}`;
  const res = '200 OK';
  s.put(x0, y + 1, `${'─'.repeat(x1 - x0)}→`, ROLE.accent, 0.85);
  s.put(x0 + Math.floor((x1 - x0 + 1 - textLen(req)) / 2), y, req, ROLE.accent);
  s.put(x0, y + 2, `←${'─'.repeat(x1 - x0)}`, ROLE.brass, 0.85);
  s.put(x0 + Math.floor((x1 - x0 + 1 - textLen(res)) / 2), y + 3, res, ROLE.brass);
  if (!c.reduce) {
    if (ph < 0.4) s.put(Math.round(lerp(x0, x1 - 1, ph / 0.4)), y + 1, '●', ROLE.accent);
    else if (ph >= 0.5 && ph < 0.9)
      s.put(Math.round(lerp(x1, x0 + 1, (ph - 0.5) / 0.4)), y + 2, '●', ROLE.brass);
  }
  s.put(2, 9, '$', ROLE.accent);
  s.put(4, 9, 'tail -f api.log', ROLE.ink);
  const ev = 8 + Math.floor(A / 1.2),
    rows = 11;
  for (let k = 0; k < rows; k++) {
    const e = ev - rows + 1 + k,
      newest = k === rows - 1;
    const tp = newest && !c.reduce ? clamp((A % 1.2) / 0.3) : 1;
    const alpha = newest ? 1 : 0.3 + 0.6 * (k / rows);
    const kk = types.length ? (types[mod(Math.floor(e / 2), types.length)] ?? '') : '';
    const parts: Array<[string, Role]> =
      mod(e, 2) === 0
        ? [
            ['App ', ROLE.ink],
            ['→ ', ROLE.muted],
            [/soap/i.test(kk) ? 'POST /invoices' : 'GET  /invoices', ROLE.accent],
            ...(kk ? [[`         ${kk}`, ROLE.subtle] as [string, Role]] : []),
          ]
        : [
            ['API ', ROLE.ink],
            ['← ', ROLE.muted],
            ['200 OK', ROLE.brass],
          ];
    let shown = Math.round(parts.reduce((n, p) => n + textLen(p[0]), 0) * tp);
    let x = 2;
    for (const [txt, role] of parts) {
      if (shown <= 0) break;
      x = s.put(x, 10 + k, [...txt].slice(0, shown).join(''), role, alpha);
      shown -= textLen(txt);
    }
  }
}

function pbox(
  s: Screen,
  x: number,
  y: number,
  w: number,
  lines: Array<[string, 'c' | 'r', string]>,
  z: 0 | 1 | 2,
): void {
  const role = z === 2 ? ROLE.brass : z === 1 ? ROLE.accent : ROLE.muted;
  const a = z === 0 ? 0.45 : 1;
  s.put(x, y, `╭${'─'.repeat(w - 2)}╮`, role, a);
  for (let k = 1; k <= 2; k++) {
    s.put(x, y + k, '│', role, a);
    s.put(x + w - 1, y + k, '│', role, a);
  }
  s.put(x, y + 3, `╰${'─'.repeat(w - 2)}╯`, role, a);
  lines.forEach(([txt, mark, mz], k) => {
    const nx = s.put(x + 2, y + 1 + k, txt, z === 0 ? ROLE.muted : ROLE.ink, z === 0 ? 0.55 : 1);
    if (mz)
      s.put(
        mark === 'c' ? x + Math.floor(w / 2) : nx + 1,
        y + 1 + k + (mark === 'c' ? 1 : 0),
        mz,
        mz === '✓' ? ROLE.brass : ROLE.accent,
      );
  });
}

function figPipeline(c: Ctx, a: KodArea): void {
  const { s } = c;
  s.put(2, 1, `// ${fit(a.title, 50)}`, ROLE.subtle);
  // mağaza adları yalnız alanın etiketlerinden (§4.8.5); yoksa genel "release" adımı
  const storeTags = find(a.tags, /app ?store|google play|appgallery/i);
  const stores = (storeTags.length ? storeTags : ['release']).slice(0, 2);
  const A = c.reduce ? 99 : c.age;
  const spin = '|/-\\'[Math.floor(A * 12) % 4] ?? '|';
  const ST: Array<[number, number]> = [
    [0.85, 1.35],
    [1.5, 2.0],
    [2.15, 2.65],
    [2.8, 3.3],
  ];
  const z = ST.map(([p, r]) => (A >= r ? 2 : A >= p ? 1 : 0) as 0 | 1 | 2);
  const mk = (k: number) => (z[k] === 2 ? '✓' : z[k] === 1 ? spin : '');
  pbox(s, 4, 3, 9, [['build', 'c', mk(0)]], z[0] ?? 0);
  s.put(14, 4, '→', ROLE.muted, z[0] === 2 ? 1 : 0.4);
  pbox(s, 16, 3, 8, [['test', 'c', mk(1)]], z[1] ?? 0);
  s.put(25, 4, '→', ROLE.muted, z[1] === 2 ? 1 : 0.4);
  const zs = (z[2] === 2 && z[3] === 2 ? 2 : z[2] || z[3] ? 1 : 0) as 0 | 1 | 2;
  pbox(
    s,
    27,
    3,
    19,
    stores.map((st, k) => [fit(st, 12), 'r', mk(2 + k)] as [string, 'c' | 'r', string]),
    zs,
  );
  const ly = 9,
    cmd = 'flutter build',
    n = Math.round(cmd.length * clamp((A - 0.15) / 0.5));
  s.put(2, ly, '$', ROLE.accent);
  s.put(4, ly, cmd.slice(0, n), ROLE.ink);
  if (n < cmd.length) cursor(c, 4 + n, ly);
  ['build', 'test', ...stores].forEach((name, k) => {
    if (!z[k]) return;
    const yy = ly + 1 + k,
      m = mk(k),
      mr = m === '✓' ? ROLE.brass : ROLE.accent;
    if (k < 2) {
      s.put(2, yy, m, mr);
      s.put(4, yy, name, ROLE.ink);
    } else {
      s.put(2, yy, '→', ROLE.muted);
      const x = s.put(4, yy, name, ROLE.ink);
      s.put(x + 1, yy, m, mr);
    }
  });
  if (A >= 3.45) {
    s.put(2, ly + 5, '$', ROLE.accent);
    cursor(c, 4, ly + 5);
  }
}

/** Satırları ~W sütuna böler (kelime sınırında) */
export function wrapText(text: string, W: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && textLen(cur) + 1 + textLen(w) > W) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

function figList(c: Ctx, a: KodArea): void {
  const { s } = c;
  s.put(2, 1, `// ${fit(a.title, 50)}`, ROLE.subtle);
  let y = 3;
  for (const cap of a.capabilities) {
    const lines = wrapText(cap, 48);
    lines.forEach((l, k) => {
      if (y > s.rows - 3) return;
      if (k === 0) s.put(2, y, '-', ROLE.accent);
      s.put(4, y, l, ROLE.ink, 0.9);
      y++;
    });
    y++;
  }
  if (a.tags.length && y <= s.rows - 3)
    s.put(2, Math.min(y, s.rows - 3), fit(`# ${a.tags.join(' · ')}`, 52), ROLE.brass);
}

const FIGURE_TITLE: Record<KodArea['figure'], (a: KodArea) => string> = {
  phone: (a) => ['preview', ...find(a.tags, /^(ios|android|ipados|web)$/i)].join(' · '),
  tree: () => 'tree lib',
  api: () => 'api.log',
  pipeline: () => 'ci · flutter build',
  list: (a) => `${a.id}.md`,
};
const FIGURE_LEFT: Record<KodArea['figure'], string> = {
  phone: 'flutter',
  tree: 'clean architecture',
  api: 'http',
  pipeline: 'ci/cd',
  list: 'notes',
};

function rArea(c: Ctx, index: number): void {
  const { s, d } = c;
  const a = d.areas[Math.max(0, Math.min(d.areas.length - 1, index))];
  if (!a) {
    chrome(s, 'areas', '', '');
    return;
  }
  const k = d.areas.indexOf(a);
  chrome(s, FIGURE_TITLE[a.figure](a), FIGURE_LEFT[a.figure], `${k + 1}/${d.areas.length}`);
  if (a.figure === 'phone') figPhone(c, a);
  else if (a.figure === 'tree') figTree(c, a);
  else if (a.figure === 'api') figApi(c, a);
  else if (a.figure === 'pipeline') figPipeline(c, a);
  else figList(c, a);
}

/* ───────── yolculuk: git log --graph ───────── */

const months = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return (y ?? 0) * 12 + ((m ?? 1) - 1);
};

/** Commit satırları zamanla orantılı, en az 3 satır aralıklı; yıl çentikleri araya düşer */
export function gitLogLayout(
  entries: readonly KodEntry[],
  top = 3,
  bottom = 19,
): { rows: number[]; years: Array<[number, string]> } {
  if (!entries.length) return { rows: [], years: [] };
  const ms = entries.map((e) => months(e.date));
  const newest = Math.max(...ms),
    oldest = Math.min(...ms),
    span = Math.max(1, newest - oldest);
  const rows: number[] = [];
  ms.forEach((m, k) => {
    let r = Math.round(top + ((newest - m) / span) * (bottom - top));
    if (k > 0) r = Math.max(r, (rows[k - 1] ?? top) + 3);
    rows.push(r);
  });
  // taşarsa yukarı sıkıştır (en az 3 satır aralık korunur)
  const over = (rows.at(-1) ?? bottom) - bottom;
  if (over > 0)
    for (let k = rows.length - 1; k >= 0; k--)
      rows[k] = Math.max(top + 3 * k, (rows[k] ?? 0) - over);
  // yıl çentikleri komşu iki commit'in GERÇEK satırları arasında enterpolasyonla yerleşir: commit'ler en az 3 satır
  // aralıkla itildiğinde de eksen kronolojik kalır (çentik, yeni commit'in altında ve eski commit'in üstünde)
  const years: Array<[number, string]> = [];
  const taken = new Set(rows);
  for (let y = Math.floor(newest / 12); y * 12 > oldest; y--) {
    const M = y * 12;
    const i = ms.findIndex((m, k) => m >= M && (ms[k + 1] ?? -Infinity) < M);
    const r0 = rows[i],
      r1 = rows[i + 1],
      m0 = ms[i],
      m1 = ms[i + 1];
    if (r0 === undefined || r1 === undefined || m0 === undefined || m1 === undefined) continue;
    const r = Math.round(r0 + ((r1 - r0) * (m0 - M)) / Math.max(1, m0 - m1));
    if (r <= r0 || r >= r1 || taken.has(r) || years.some(([yr]) => Math.abs(yr - r) < 2)) continue;
    years.push([r, String(y)]);
  }
  return { rows, years };
}

/** git log'un 24 satıra sığan kayıt sayısı (top 3, en az 3 satır aralık, kurum satırı çerçevenin içinde) */
const JOURNEY_MAX = 7;

function rJourney(c: Ctx, active: number): void {
  const { s, d } = c;
  const n = d.journey.length;
  // sayaç DOM'daki girdilere göredir (etkin indeks deneyim listesinden gelir; eğitim sayılmaz)
  const E = d.journey.filter((e) => !e.edu).length;
  chrome(s, 'git log --graph', 'main', E && active >= 0 ? `${active + 1}/${E}` : '');
  s.put(2, 1, '$', ROLE.accent);
  s.put(4, 1, 'git log --graph --date=short', ROLE.ink);
  if (!n) return;
  // sığmayan en eski kayıtlar "…" ile kısalır (§4.10.3)
  const cut = n > JOURNEY_MAX;
  const shown = cut ? d.journey.slice(0, JOURNEY_MAX - 1) : d.journey;
  const gx = 7;
  const { rows, years } = gitLogLayout(shown);
  const last = rows.at(-1) ?? 3;
  for (let y = 3; y <= last + (cut ? 2 : 0); y++) s.put(gx, y, '│', ROLE.muted, 0.6);
  for (const [y, yr] of years) {
    s.put(1, y, yr, ROLE.subtle, 0.9);
    s.put(gx - 1, y, '─', ROLE.muted, 0.6); // çentik dal çizgisine bitişik: "2025 ─┤"
    s.put(gx, y, '┤', ROLE.muted, 0.6);
  }
  shown.forEach((e, k) => {
    // etkin kayıt DOM'daki girdi indeksiyle eşlenir (ref; yoksa sıra)
    const y = rows[k] ?? 3,
      on = active >= 0 && (e.ref ?? k) === active,
      fx = on ? 1 : 0;
    if (on) s.bg(gx - 1, y, s.cols - 2, y + 1, ROLE.accent, 0.17);
    s.put(gx, y, '*', e.edu ? ROLE.brass : ROLE.accent, 1, fx);
    s.put(gx + 2, y, e.date, on ? ROLE.ink : ROLE.muted, on ? 1 : 0.8, fx);
    // süren rolde (HEAD) her zaman sığar: başlık 7 sütun kısa kesilir
    const title = fit(e.title, e.current ? 30 : 32);
    const x = s.put(gx + 10, y, title, on ? ROLE.accent : ROLE.ink, on ? 1 : 0.62, fx);
    if (e.current)
      s.put(x + 1, y, '(HEAD)', ROLE.accent, c.reduce ? 1 : 0.7 + 0.3 * Math.sin(c.age * 3), fx);
    s.put(gx + 10, y + 1, fit(e.at, 38), on ? ROLE.ink : ROLE.muted, on ? 0.95 : 0.6, fx);
  });
  if (cut) s.put(gx + 2, last + 3, `… ${n - shown.length}`, ROLE.subtle);
}

/* ───────── iletişim: terminal ───────── */

function rContact(c: Ctx): void {
  const { s, d } = c;
  chrome(s, 'zsh', d.place, '');
  const stores = [...new Set(d.projects.flatMap((p) => p.stores))].slice(0, 2);
  const hist = [
    '$ flutter run lib/main.dart',
    '$ cat about.dart',
    '$ flutter build',
    ...(stores.length ? [stores.map((x) => `✓ ${x}`).join('  ')] : []),
    '$ git log --graph --date=short',
  ];
  hist.forEach((l, k) => s.put(2, 1 + k, fit(l, 52), ROLE.muted, 0.38));
  const leadY = 2 + hist.length;
  const lead = wrapText(d.lead, 48).slice(0, 3);
  lead.forEach((l, k) => s.put(2, leadY + k, `# ${l}`, ROLE.subtle));
  const y = leadY + lead.length + 1;
  const A = c.reduce ? 99 : c.age;
  const verb = 'mail ',
    mail = fit(d.email, 46),
    total = textLen(verb) + textLen(mail);
  const t0 = 0.35,
    n = Math.round(total * clamp((A - t0) / (total * 0.045)));
  s.put(2, y, '$', ROLE.accent);
  const x = s.put(4, y, verb.slice(0, n), ROLE.ink);
  s.put(x, y, [...mail].slice(0, Math.max(0, n - textLen(verb))).join(''), ROLE.accent);
  if (A < t0 + total * 0.045 + 0.45) cursor(c, 4 + n, y);
  else {
    s.put(2, y + 1, '✓', ROLE.brass);
    s.put(2, y + 2, '$', ROLE.accent);
    cursor(c, 4, y + 2);
  }
}

/* ───────── derin sayfalar ───────── */

function yamlLine(s: Screen, y: number, key: string, value: string, indent = 0): void {
  const x = s.put(5 + indent, y, `${key}:`, ROLE.brass);
  if (value) s.put(x + 1, y, fit(value, s.cols - x - 3), ROLE.ink);
}

function project(d: KodData, slug: string): KodProject | undefined {
  return d.projects.find((p) => p.slug === slug) ?? d.projects[0];
}

function rFolio(c: Ctx, slug: string): void {
  const { s, d } = c;
  const p = project(d, slug);
  chrome(s, `${p?.slug ?? slug}.yaml`, 'yaml · utf-8', p?.year ?? '');
  if (!p) return;
  let y = 1;
  const num = () => lineNo(s, y, y);
  num();
  s.put(5, y++, fit(`# ${p.title}`, 50), ROLE.subtle);
  for (const [k, v] of [
    ['project', p.slug],
    ['role', p.role],
    ['year', p.year],
    ['status', p.status],
  ] as const) {
    num();
    yamlLine(s, y++, k, v);
  }
  if (p.areas.length) {
    num();
    yamlLine(s, y++, 'areas', `[${p.areas.join(', ')}]`);
  }
  if (p.facts.length) {
    num();
    yamlLine(s, y++, 'facts', '');
    for (const [k, v] of p.facts) {
      if (y > s.rows - 5) break;
      num();
      yamlLine(s, y++, k, v, 2);
    }
  }
  if (p.stores.length && y <= s.rows - 3 - p.stores.length) {
    num();
    yamlLine(s, y++, 'stores', '');
    for (const st of p.stores) {
      num();
      s.put(7, y, '-', ROLE.muted);
      s.put(9, y++, st, ROLE.accent);
    }
  }
  cursor(c, 5, Math.min(y, s.rows - 2));
}

function rNext(c: Ctx, slug: string): void {
  const { s, d } = c;
  const p = project(d, slug);
  chrome(s, 'zsh', 'projects/', '');
  if (!p) return;
  s.put(2, 2, '$', ROLE.accent);
  s.put(4, 2, fit(`cd ../${p.slug}`, 48), ROLE.ink);
  s.put(2, 3, '$', ROLE.accent);
  s.put(4, 3, 'head -4 project.yaml', ROLE.ink);
  s.put(2, 5, fit(`# ${p.title}`, 52), ROLE.subtle);
  yamlLine(s, 6, 'project', p.slug, -3);
  yamlLine(s, 7, 'role', p.role, -3);
  yamlLine(s, 8, 'year', p.year, -3);
  s.put(2, 10, '$', ROLE.accent);
  cursor(c, 4, 10);
}

function rList(c: Ctx, filter: string | null): void {
  const { s, d } = c;
  const n = d.projects.filter((p) => !filter || p.areas.includes(filter)).length;
  chrome(s, 'zsh', 'projects/', L[d.locale].items(n));
  s.put(2, 2, '$', ROLE.accent);
  s.put(4, 2, fit(filter ? `ls projects/ --area=${filter}` : 'ls projects/', 50), ROLE.ink);
  const w = Math.min(30, Math.max(...d.projects.map((p) => textLen(p.slug)), 8) + 2);
  d.projects.forEach((p, k) => {
    const y = 4 + k * 2;
    if (y > s.rows - 3) return;
    const on = !filter || p.areas.includes(filter);
    const a = on ? 1 : 0.3;
    s.put(2, y, on ? '▸' : ' ', ROLE.accent, a);
    s.put(4, y, fit(`${p.slug}/`, w), ROLE.ink, a);
    s.put(4 + w + 1, y, p.year, ROLE.brass, a);
    s.put(4 + w + 7, y, fit(p.areas[0] ?? '', s.cols - w - 13), ROLE.subtle, a);
  });
  const y = Math.min(s.rows - 2, 4 + d.projects.length * 2);
  s.put(2, y, '$', ROLE.accent);
  cursor(c, 4, y);
}

function rNotFound(c: Ctx, path: string, links: ReadonlyArray<readonly [string, string]>): void {
  const { s, d } = c;
  chrome(s, 'zsh', '404', '');
  s.put(2, 2, '$', ROLE.accent);
  s.put(4, 2, fit(`open ${path}`, 50), ROLE.ink);
  s.put(2, 4, fit(`Error: 404 · ${L[d.locale].notFound}`, 52), ROLE.accent);
  s.put(4, 5, fit(`at Router.resolve (${q(path)})`, 50), ROLE.muted, 0.8);
  s.put(4, 6, 'at Site.navigate', ROLE.muted, 0.8);
  s.put(2, 8, L[d.locale].suggest, ROLE.subtle);
  links.forEach(([href, label], k) => {
    const y = 9 + k;
    if (y > s.rows - 3) return;
    s.put(2, y, '→', ROLE.muted);
    s.put(4, y, fit(href, 18), ROLE.ink);
    s.put(24, y, fit(label, 28), ROLE.brass);
  });
  const y = Math.min(s.rows - 2, 10 + links.length);
  s.put(2, y, '$', ROLE.accent);
  cursor(c, 4, y);
}

/* ───────── dağıtıcı ───────── */

export interface NotFoundLinks {
  links: ReadonlyArray<readonly [string, string]>;
}

/** Programı ekrana yazar. age: programın başlangıcından beri saniye; reduce: zamanlı hareket yok (son hâl). */
export function renderProgram(
  s: Screen,
  d: KodData,
  p: KodProgram,
  age: number,
  reduce: boolean,
  extra?: NotFoundLinks,
): void {
  s.clear();
  const c: Ctx = { s, d, age, reduce };
  switch (p.kind) {
    case 'hero':
      return rHero(c);
    case 'about':
      return rAbout(c, p.reveal);
    case 'area':
      return rArea(c, p.index);
    case 'journey':
      return rJourney(c, p.active);
    case 'contact':
      return rContact(c);
    case 'folio':
      return rFolio(c, p.slug);
    case 'next':
      return rNext(c, p.slug);
    case 'list':
      return rList(c, p.filter);
    case 'notfound':
      return rNotFound(c, p.path, extra?.links ?? []);
  }
}

/** Statik panel: programın son hâli (zamanlı efektler bitmiş, imleç açık) */
export function finalScreen(d: KodData, p: KodProgram, extra?: NotFoundLinks): Screen {
  const s = new Screen();
  renderProgram(s, d, p, 99, true, extra);
  return s;
}

/** Programın kimliği: değişince WebGL yeni içeriği çözer */
export function programKey(p: KodProgram): string {
  switch (p.kind) {
    case 'about':
      return `about:${p.reveal}`;
    case 'area':
      return `area:${p.index}`;
    case 'journey':
      return `journey:${p.active}`;
    case 'folio':
    case 'next':
      return `${p.kind}:${p.slug}`;
    case 'list':
      return `list:${p.filter ?? ''}`;
    case 'notfound':
      return `notfound:${p.path}`;
    default:
      return p.kind;
  }
}
