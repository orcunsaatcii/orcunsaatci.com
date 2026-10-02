// src/lib/kod/programs.test.ts — KOD programları: tohum içerikle beklenen satırlar, ızgara sınırları, son karenin
// t'den bağımsızlığı, statik panel eşliği ve içerikte olmayan olgunun yazılmaması (§5.20.2, §13.2.2, K-KOD-2, K-KOD-5).
import { describe, expect, it } from 'vitest';
import {
  aboutBlocks,
  chrome,
  finalScreen,
  fit,
  gitLogLayout,
  programKey,
  renderProgram,
  wrapText,
  type NotFoundLinks,
} from './programs';
import { GLYPHS, KOD_COLS, KOD_ROWS, ROLE, Screen, screenRuns, type Role } from './screen';
import type { KodArea, KodData, KodEntry, KodProgram } from './types';

/* ───────── tohum içerik (gerçek içerik dosyalarından bağımsız) ───────── */

const D: KodData = {
  locale: 'tr',
  name: 'Ada Lovelace',
  varName: 'ada',
  title: 'Mobile Developer | Flutter',
  city: 'İzmir',
  since: 2015,
  now: 'Kıdemli Geliştirici · Acme',
  skills: ['Flutter', 'Dart', 'Kotlin'],
  areas: [
    {
      id: 'mobil',
      title: 'Mobil Uygulamalar',
      figure: 'phone',
      tags: ['Flutter', 'Dart', 'iOS', 'Android', 'Material 3'],
      capabilities: ['Uçtan uca uygulama geliştiriyorum.'],
    },
    {
      id: 'mimari',
      title: 'Yazılım Mimarisi',
      figure: 'tree',
      tags: ['MVVM', 'Riverpod', 'Clean Architecture', 'REST'],
      capabilities: [],
    },
    {
      id: 'servis',
      title: 'Servis Entegrasyonu',
      figure: 'api',
      tags: ['REST', 'SOAP', 'Veri modelleme'],
      capabilities: [],
    },
    {
      id: 'yayin',
      title: 'Yayın Yönetimi',
      figure: 'pipeline',
      tags: ['App Store', 'Google Play', 'CI/CD'],
      capabilities: [],
    },
    {
      id: 'arge',
      title: 'Ar-Ge',
      figure: 'list',
      tags: ['Prototip', 'Ölçüm'],
      capabilities: ['Hızlı prototipleme ve ölçüm odaklı deneyler yürütüyorum.', 'Raporlama'],
    },
  ],
  journey: [
    { date: '2023-01', title: 'Kıdemli Geliştirici', at: '@ Acme', edu: false, current: true },
    { date: '2019-05', title: 'Geliştirici', at: '@ Beta', edu: false, current: false },
    {
      date: '2010-09',
      title: 'Lisans, Bilgisayar Mühendisliği',
      at: '@ Ege Üniversitesi',
      edu: true,
      current: false,
    },
  ],
  email: 'ada@example.com',
  lead: 'Yeni bir proje için yazın; en geç iki gün içinde dönüş yaparım.',
  place: 'İzmir · GMT+3',
  projects: [
    {
      slug: 'kasa',
      title: 'Kasa',
      year: '2024',
      role: 'Geliştirici',
      status: 'live',
      areas: ['mobil', 'yayin'],
      facts: [['Kullanıcı', '10K']],
      stores: ['App Store', 'Google Play'],
    },
    {
      slug: 'rota',
      title: 'Rota',
      year: '2022',
      role: 'Lider',
      status: 'done',
      areas: ['servis'],
      facts: [],
      stores: [],
    },
    {
      slug: 'not-defteri',
      title: 'Not Defteri',
      year: '2021',
      role: 'Geliştirici',
      status: 'archived',
      areas: ['mobil'],
      facts: [],
      stores: [],
    },
  ],
};
const D_EN: KodData = { ...D, locale: 'en' };
const EMPTY: KodData = {
  ...D,
  since: null,
  now: null,
  skills: [],
  areas: [],
  journey: [],
  projects: [],
};
const LINKS: NotFoundLinks = {
  links: [
    ['/', 'Ana sayfa'],
    ['/projeler', 'Projeler'],
    ['/iletisim', 'İletişim'],
  ],
};

/** n kod noktalı uzun metin (şema üst sınırlarını zorlamak için) */
const long = (n: number) => 'Çok uzun bir içerik satırı · '.repeat(10).slice(0, n);
/** Şema üst sınırlarında içerik. Beceriler ≤ 43 karakter: daha uzunu bilinen bir hatadır (aşağıda, atlanmış test). */
const LONG: KodData = {
  locale: 'tr',
  name: long(80),
  varName: 'ada',
  title: long(60),
  city: long(40),
  since: 2015,
  now: long(60),
  skills: [
    long(43),
    'Dart',
    long(30),
    'Kotlin',
    long(20),
    'Swift',
    long(43),
    'Go',
    'Rust',
    long(12),
  ],
  areas: (['phone', 'tree', 'api', 'pipeline', 'list'] as const).map((figure, k): KodArea => ({
    id: `alan-${k}-${'x'.repeat(20)}`,
    title: long(30),
    figure,
    tags: [
      long(24),
      'iOS',
      'GraphQL',
      'App Store Connect Portal',
      'Google Play Console Beta',
      'REST',
    ],
    capabilities: Array.from({ length: 8 }, () => long(120)),
  })),
  // 7 kayıt: çerçeveye sığan en uzun yolculuk (8+ kayıt bilinen bir hatadır, aşağıda)
  journey: Array.from({ length: 7 }, (_, k): KodEntry => ({
    date: `${2025 - 2 * k}-0${k + 1}`,
    title: long(80),
    at: `@ ${long(78)}`,
    edu: k === 6,
    current: k === 0,
  })),
  email: `${'a'.repeat(64)}@${'b'.repeat(60)}.com`,
  lead: long(90),
  place: `${long(40)} · GMT+3`,
  projects: Array.from({ length: 12 }, (_, k) => ({
    slug: `proje-${k}-${'x'.repeat(50)}`,
    title: long(60),
    year: String(2024 - k),
    role: long(60),
    status: 'ongoing',
    areas: [`alan-${k % 5}-${'x'.repeat(20)}`, 'alan-1', 'alan-2'],
    facts: Array.from({ length: 4 }, () => [long(24), long(40)] as const),
    stores: [long(40), long(40)],
  })),
};
const LONG_LINKS: NotFoundLinks = {
  links: Array.from({ length: 15 }, (_, k) => [`/${long(40)}/${k}`, long(60)] as const),
};

/** Her program türü ve uç durumları */
function programs(d: KodData): KodProgram[] {
  return [
    { kind: 'hero' },
    { kind: 'about', reveal: 0 },
    { kind: 'about', reveal: 0.5 },
    { kind: 'about', reveal: 1 },
    ...d.areas.map((_, index): KodProgram => ({ kind: 'area', index })),
    { kind: 'area', index: -1 },
    { kind: 'area', index: 99 },
    { kind: 'journey', active: -1 },
    ...d.journey.map((_, active): KodProgram => ({ kind: 'journey', active })),
    { kind: 'contact' },
    ...d.projects.map((p): KodProgram => ({ kind: 'folio', slug: p.slug })),
    { kind: 'folio', slug: 'olmayan-proje' },
    { kind: 'next', slug: d.projects[1]?.slug ?? 'olmayan-proje' },
    { kind: 'list', filter: null },
    { kind: 'list', filter: d.areas[0]?.id ?? 'mobil' },
    { kind: 'list', filter: 'olmayan-alan' },
    { kind: 'notfound', path: '/olmayan/sayfa' },
  ];
}

/* ───────── ekran okuma yardımcıları ───────── */

const at = (s: Screen, x: number, y: number) => y * s.cols + x;
const glyph = (s: Screen, x: number, y: number) => GLYPHS[s.g[at(s, x, y)] ?? 0] ?? '?';
const role = (s: Screen, x: number, y: number) => s.fr[at(s, x, y)];
const alpha = (s: Screen, x: number, y: number) => s.fa[at(s, x, y)] ?? 0;
const bgAlpha = (s: Screen, x: number, y: number) => s.ba[at(s, x, y)] ?? 0;

/** Görünen metin, satır başına bir dize (hücre = karakter; tüm glifler BMP'de) */
function lines(s: Screen): string[] {
  return Array.from({ length: s.rows }, (_, y) =>
    Array.from({ length: s.cols }, (_, x) => (alpha(s, x, y) > 0.003 ? glyph(s, x, y) : ' ')).join(
      '',
    ),
  );
}
const rowText = (s: Screen, y: number) => lines(s)[y] ?? '';
const screenText = (s: Screen) => lines(s).join('\n');
/** Dizenin ilk konumu [x, y] */
function locate(s: Screen, str: string): [number, number] | null {
  const ls = lines(s);
  for (let y = 0; y < ls.length; y++) {
    const x = ls[y]?.indexOf(str) ?? -1;
    if (x >= 0) return [x, y];
  }
  return null;
}
const count = (s: Screen, str: string) => screenText(s).split(str).length - 1;
/** Bir satırın x sütunundan başlayan metni (sağ boşluk atılır) */
const textFrom = (s: Screen, x: number, y: number) =>
  rowText(s, y)
    .slice(x, KOD_COLS - 1)
    .trimEnd();
const buffers = (s: Screen) => [s.g, s.fr, s.fa, s.br, s.ba, s.fx];

/* ───────── ızgara denetimi ───────── */

/**
 * Yazımları kaydeden ekran. Pencere çerçevesi (chrome) her programda ilk yazılır; iç alana (1…54 × 1…22) değen ilk
 * yazımdan sonra çerçeve hücrelerine ya da ızgara dışına düşen her yazım bir sınır ihlalidir.
 */
class Probe extends Screen {
  readonly outside: string[] = [];
  readonly onFrame: string[] = [];
  private framed = false;

  private check(cells: Array<readonly [number, number]>, what: string): void {
    if (!cells.length) return;
    const inGrid = cells.every(([x, y]) => x >= 0 && x < this.cols && y >= 0 && y < this.rows);
    const inner = cells.every(
      ([x, y]) => x >= 1 && x < this.cols - 1 && y >= 1 && y < this.rows - 1,
    );
    if (!inGrid) this.outside.push(what);
    if (inner) this.framed = true;
    else if (this.framed) this.onFrame.push(what);
  }

  override put(x: number, y: number, s: string, r?: Role, a?: number, fx?: number): number {
    this.check(
      [...s].map((_, k) => [x + k, y] as const),
      `put(${x}, ${y}, ${JSON.stringify(s)})`,
    );
    return super.put(x, y, s, r, a, fx);
  }

  override bg(x0: number, y0: number, x1: number, y1: number, r: Role, a: number): void {
    const cells: Array<readonly [number, number]> = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push([x, y]);
    this.check(cells, `bg(${x0}, ${y0}, ${x1}, ${y1})`);
    super.bg(x0, y0, x1, y1, r, a);
  }
}

/** Köşeler ve yan kenarlar chrome'un çizdiği gibi kalmalı (muted, 0.75) */
function frameBreaks(s: Screen): string[] {
  const bad: string[] = [];
  const C = s.cols,
    R = s.rows;
  const want = (x: number, y: number, c: string) => {
    if (glyph(s, x, y) !== c || role(s, x, y) !== ROLE.muted || alpha(s, x, y) !== 0.75)
      bad.push(`(${x}, ${y}) = ${JSON.stringify(glyph(s, x, y))}`);
  };
  want(0, 0, '╭');
  want(C - 1, 0, '╮');
  want(0, R - 1, '╰');
  want(C - 1, R - 1, '╯');
  for (let y = 1; y < R - 1; y++) {
    want(0, y, '│');
    want(C - 1, y, '│');
  }
  return bad;
}

/** Tampon değerleri geçerli: glif kümede, saydamlıklar [0, 1] (NaN yok), roller ve fx tanımlı */
function invalid(s: Screen): string[] {
  const bad: string[] = [];
  for (let i = 0; i < s.cols * s.rows; i++) {
    const fa = s.fa[i] ?? Number.NaN,
      ba = s.ba[i] ?? Number.NaN;
    if ((s.g[i] ?? 0) >= GLYPHS.length) bad.push(`g[${i}]`);
    if (!(fa >= 0 && fa <= 1)) bad.push(`fa[${i}] = ${fa}`);
    if (!(ba >= 0 && ba <= 1)) bad.push(`ba[${i}] = ${ba}`);
    if ((s.fr[i] ?? 0) > ROLE.scramble || (s.br[i] ?? 0) > ROLE.scramble) bad.push(`rol[${i}]`);
    if ((s.fx[i] ?? 0) > 1) bad.push(`fx[${i}]`);
  }
  return bad;
}

function audit(d: KodData, p: KodProgram, age: number, reduce: boolean, extra?: NotFoundLinks) {
  const s = new Probe();
  renderProgram(s, d, p, age, reduce, extra);
  const tag = `${programKey(p)} @${age}${reduce ? ' reduce' : ''}`;
  return [
    ...s.outside.map((w) => `${tag}: ızgara dışı ${w}`),
    ...s.onFrame.map((w) => `${tag}: çerçeveye yazım ${w}`),
    ...frameBreaks(s).map((w) => `${tag}: çerçeve bozuk ${w}`),
    ...invalid(s).map((w) => `${tag}: geçersiz ${w}`),
    ...(s.g.length === KOD_COLS * KOD_ROWS ? [] : [`${tag}: tampon boyu ${s.g.length}`]),
  ];
}

const AGES = [0, 0.1, 0.36, 0.7, 1.06, 1.5, 2.4, 3.3, 3.5, 7.7, 99];

/* ───────── statik panel görünümü (KodPanel sözleşmesi) ───────── */

const r2 = (x: number) => Math.round(x * 100) / 100;
function cellView(s: Screen, i: number) {
  const c = GLYPHS[s.g[i] ?? 0] ?? ' ';
  const visible = (s.fa[i] ?? 0) > 0.003 && c !== ' ';
  const ba = r2(s.ba[i] ?? 0);
  return {
    c: visible ? c : ' ',
    role: visible ? s.fr[i] : ROLE.ink,
    alpha: visible ? r2(s.fa[i] ?? 0) : 0,
    bgRole: ba > 0 ? s.br[i] : ROLE.ink,
    ba,
  };
}

/* ───────── testler ───────── */

describe('renderProgram: ızgara sınırları (§5.20.2, §13.2.2)', () => {
  const cases: Array<[string, KodData, NotFoundLinks]> = [
    ['tohum', D, LINKS],
    ['tohum EN', D_EN, LINKS],
    ['boş içerik', EMPTY, { links: [] }],
    ['şema üst sınırları', LONG, LONG_LINKS],
  ];
  it.each(cases)(
    '%s: her program ızgara içinde kalır, çerçeveye yazmaz, tampon geçerli',
    (_, d, extra) => {
      const problems: string[] = [];
      for (const p of programs(d))
        for (const age of AGES)
          for (const reduce of [false, true]) problems.push(...audit(d, p, age, reduce, extra));
      expect(problems).toEqual([]);
    },
  );

  it('uzun değerler fit() ile "…" ile kısalır', () => {
    const hero = finalScreen(LONG, { kind: 'hero' });
    for (const y of [11, 12, 13]) expect(rowText(hero, y).slice(5, 55)).toMatch(/…$/);
    const folio = finalScreen(LONG, { kind: 'folio', slug: LONG.projects[0]!.slug });
    expect(rowText(folio, 0)).toContain('…');
    expect(rowText(folio, 1)).toMatch(/# Çok uzun.*…/);
    const contact = finalScreen(LONG, { kind: 'contact' });
    expect(screenText(contact)).toMatch(/\$ mail a+…/);
  });

  it('kirli ekrana yeniden çizim artık bırakmaz (renderProgram önce temizler)', () => {
    const s = new Screen();
    renderProgram(s, LONG, { kind: 'list', filter: null }, 99, true);
    renderProgram(s, D, { kind: 'hero' }, 99, true);
    expect(buffers(s)).toEqual(buffers(finalScreen(D, { kind: 'hero' })));
  });
});

describe('son kare t’den bağımsızdır (§5.20.2, §4.1.5)', () => {
  it.each([
    ['tohum', D, LINKS],
    ['şema üst sınırları', LONG, LONG_LINKS],
  ] as const)('%s: reduce karesi her yaşta finalScreen ile hücre hücre aynı', (_, d, extra) => {
    const s = new Screen();
    for (const p of programs(d)) {
      const want = buffers(finalScreen(d, p, extra));
      for (const age of [0, 0.3, 1.06, 2.4, 3.45, 99, 1000, 123456.7]) {
        renderProgram(s, d, p, age, true, extra);
        expect(buffers(s), `${programKey(p)} @${age}`).toEqual(want);
      }
    }
  });

  it('zamanlı yazma ve hat animasyonu biter: canlı kare (imleç açık evrede) son kareyle aynı', () => {
    // telefon satırları, akan log ve (HEAD) nabzı süresizdir; onları donma (reduce) durdurur (§4.8.5, §4.10.3)
    const settling: KodProgram[] = [
      { kind: 'hero' },
      { kind: 'about', reveal: 1 },
      { kind: 'area', index: 1 },
      { kind: 'area', index: 3 },
      { kind: 'area', index: 4 },
      { kind: 'contact' },
      { kind: 'folio', slug: 'kasa' },
      { kind: 'next', slug: 'rota' },
      { kind: 'list', filter: null },
      { kind: 'list', filter: 'mobil' },
      { kind: 'notfound', path: '/yok' },
    ];
    const age = 1.06 * 40 + 0.3; // imleç periyodu 1.06 s, açık evre < 0.6 s
    const s = new Screen();
    for (const p of settling) {
      renderProgram(s, D, p, age, false, LINKS);
      expect(buffers(s), programKey(p)).toEqual(buffers(finalScreen(D, p, LINKS)));
    }
  });

  it('dinlenme karesinde karışık glif rolü yoktur (§4.1.5)', () => {
    for (const p of programs(D)) {
      const s = finalScreen(D, p, LINKS);
      for (let i = 0; i < s.g.length; i++) {
        if ((s.fa[i] ?? 0) > 0) expect(s.fr[i]).not.toBe(ROLE.scramble);
        if ((s.ba[i] ?? 0) > 0) expect(s.br[i]).not.toBe(ROLE.scramble);
      }
    }
  });
});

describe('statik panel = tampon (K-KOD-2)', () => {
  it('her programın koşuları 24 satır × 56 hücreyi hücre hücre yeniden üretir', () => {
    for (const d of [D, LONG])
      for (const p of programs(d)) {
        const s = finalScreen(d, p, LINKS);
        const rows = screenRuns(s);
        expect(rows).toHaveLength(KOD_ROWS);
        rows.forEach((row, y) => {
          const cells = row.flatMap((r) =>
            [...r.text].map((c) => ({
              c,
              role: r.role,
              alpha: r.alpha,
              bgRole: r.bgRole,
              ba: r.bgAlpha,
            })),
          );
          expect(cells).toHaveLength(KOD_COLS);
          cells.forEach((cell, x) =>
            expect(cell, `${programKey(p)} (${x}, ${y})`).toEqual(cellView(s, at(s, x, y))),
          );
        });
      }
  });
});

describe('chrome: pencere çerçevesi (§4.1.3)', () => {
  it('yuvarlak çerçeve, üç nokta (accent, brass, muted), başlık ve durum satırı etiketleri', () => {
    const s = new Screen();
    chrome(s, 'main.dart', 'dart · utf-8', 'Ln 13, Col 35');
    expect(rowText(s, 0)).toBe(`╭─ ● ● ● ─ main.dart ${'─'.repeat(34)}╮`);
    expect(rowText(s, KOD_ROWS - 1)).toBe(`╰─ dart · utf-8 ${'─'.repeat(23)} Ln 13, Col 35 ─╯`);
    expect([role(s, 3, 0), role(s, 5, 0), role(s, 7, 0)]).toEqual([
      ROLE.accent,
      ROLE.brass,
      ROLE.muted,
    ]);
    expect(frameBreaks(s)).toEqual([]);
    for (let y = 1; y < KOD_ROWS - 1; y++) expect(rowText(s, y)).toBe(`│${' '.repeat(54)}│`);
  });

  it('boş etiketler yazılmaz; uzun başlık ve sol etiket kısalır', () => {
    const s = new Screen();
    chrome(s, '', '', '');
    expect(rowText(s, 0)).toBe(`╭─ ● ● ● ${'─'.repeat(46)}╮`);
    expect(rowText(s, KOD_ROWS - 1)).toBe(`╰${'─'.repeat(54)}╯`);
    const t = new Screen();
    chrome(t, 'x'.repeat(80), 'y'.repeat(80), '1/2');
    expect(rowText(t, 0)).toBe(`╭─ ● ● ● ─ ${'x'.repeat(41)}… ─╮`);
    expect(rowText(t, KOD_ROWS - 1)).toBe(`╰─ ${'y'.repeat(25)}… ${'─'.repeat(19)} 1/2 ─╯`);
  });
});

describe('main.dart (§4.6.4)', () => {
  const s = finalScreen(D, { kind: 'hero' });
  const nameLine = "      child: Text('Ada Lovelace'),";

  it('şehir, unvan ve ad 11–13. satırlarda Profile parametreleri olarak', () => {
    expect(textFrom(s, 5, 1)).toBe("import 'package:flutter/material.dart';");
    expect(textFrom(s, 5, 11)).toBe("      city: 'İzmir',");
    expect(textFrom(s, 5, 12)).toBe("      subtitle: 'Mobile Developer | Flutter',");
    expect(textFrom(s, 5, 13)).toBe(nameLine);
    expect(textFrom(s, 1, 16)).toBe(' 16 }');
    expect(textFrom(s, 1, 17)).toBe('');
  });

  it('çerçeve: main.dart · dart · utf-8 · Ln 13, Col <ad satırı sonu + 1>', () => {
    expect(locate(s, ' main.dart ')).toEqual([10, 0]);
    expect(locate(s, ' dart · utf-8 ')).toEqual([2, KOD_ROWS - 1]);
    const right = `Ln 13, Col ${[...nameLine].length + 1}`;
    expect(locate(s, ` ${right} `)).toEqual([KOD_COLS - 4 - right.length, KOD_ROWS - 1]);
  });

  it('ad satırı vurgulu (zemin accent ≈ %7, numara tam opak); imleç satır sonunda', () => {
    const end = 5 + [...nameLine].length;
    for (let x = 4; x <= KOD_COLS - 2; x++) {
      expect(s.br[at(s, x, 13)]).toBe(ROLE.accent);
      expect(bgAlpha(s, x, 13)).toBeCloseTo(x === end ? 0.9 : 0.07, 6);
    }
    expect(alpha(s, 3, 13)).toBeCloseTo(0.9, 6);
    expect(alpha(s, 3, 12)).toBeCloseTo(0.45, 6);
    expect(role(s, 3, 12)).toBe(ROLE.subtle);
    expect(bgAlpha(s, 10, 12)).toBe(0);
  });

  it('sözdizimi: ad dizesi accent, city: brass, const muted', () => {
    const [nx, ny] = locate(s, "'Ada Lovelace'") ?? [0, 0];
    expect(role(s, nx, ny)).toBe(ROLE.accent);
    const [cx, cy] = locate(s, 'city:') ?? [0, 0];
    expect(role(s, cx, cy)).toBe(ROLE.brass);
    const [kx, ky] = locate(s, 'const Profile(') ?? [0, 0];
    expect(role(s, kx, ky)).toBe(ROLE.muted);
  });

  it('uzun değer 50 sütunda kısalır; tırnak kaçışlanır', () => {
    const t = finalScreen({ ...D, name: "D'Artagnan ".repeat(8).trim() }, { kind: 'hero' });
    expect(textFrom(t, 5, 13)).toBe(fit(`      child: Text('${"D\\'Artagnan ".repeat(8)}`, 50));
    expect([...textFrom(t, 5, 13)]).toHaveLength(50);
  });
});

describe('about.dart (§4.7.3)', () => {
  it('içerikteki olgular Developer(...) parametreleri olarak yazılır', () => {
    const s = finalScreen(D, { kind: 'about', reveal: 1 });
    expect(Array.from({ length: 18 }, (_, k) => textFrom(s, 5, k + 1))).toEqual([
      '// Hakkımda',
      'const ada = Developer(',
      "  name: 'Ada Lovelace',",
      "  title: 'Mobile Developer | Flutter',",
      "  city: 'İzmir',",
      '  since: 2015,',
      '  areas: [',
      "    'Mobil Uygulamalar',",
      "    'Yazılım Mimarisi',",
      "    'Servis Entegrasyonu',",
      "    'Yayın Yönetimi',",
      "    'Ar-Ge',",
      '  ],',
      '  skills: [',
      "    'Flutter', 'Dart', 'Kotlin',",
      '  ],',
      "  now: 'Kıdemli Geliştirici · Acme',",
      ');',
    ]);
    expect(textFrom(s, 1, 19)).toBe('');
    expect(locate(s, ' about.dart ')).toEqual([10, 0]);
    expect(locate(s, ' 4/4 ')).not.toBeNull();
    expect(textFrom(finalScreen(D_EN, { kind: 'about', reveal: 1 }), 5, 1)).toBe('// About');
  });

  it('içerikte olmayan olgunun satırı yazılmaz (since, now, skills, areas)', () => {
    const bare: KodData = { ...D, since: null, now: null, skills: [], areas: [] };
    expect(aboutBlocks(bare)).toEqual([
      [
        '// Hakkımda',
        'const ada = Developer(',
        "  name: 'Ada Lovelace',",
        "  title: 'Mobile Developer | Flutter',",
        "  city: 'İzmir',",
      ],
      [');'],
    ]);
    const s = finalScreen(bare, { kind: 'about', reveal: 1 });
    for (const key of ['since', 'now', 'skills', 'areas', '['])
      expect(screenText(s)).not.toContain(key);
    expect(locate(s, ' 2/2 ')).not.toBeNull();
    // tek tek: yalnız eksik olgunun satırı düşer
    expect(aboutBlocks({ ...D, since: null }).flat()).not.toContain('  since: 2015,');
    expect(
      aboutBlocks({ ...D, now: null })
        .flat()
        .join('\n'),
    ).not.toMatch(/now:/);
    expect(
      aboutBlocks({ ...D, skills: [] })
        .flat()
        .join('\n'),
    ).not.toMatch(/skills:/);
    expect(aboutBlocks({ ...D, now: null }).flat()).toContain('  since: 2015,');
  });

  it('reveal blokları sırayla açar: etkin blok ┃ ve fx = 1 taşır, öncekiler söner; tamamı açıkken işaret yok', () => {
    const s0 = finalScreen(D, { kind: 'about', reveal: 0 });
    expect(locate(s0, ' 1/4 ')).not.toBeNull();
    expect(screenText(s0)).not.toContain('areas:');
    for (let y = 1; y <= 6; y++) {
      expect(glyph(s0, 4, y)).toBe('┃');
      expect(role(s0, 4, y)).toBe(ROLE.accent);
    }
    expect(s0.fx[at(s0, 5, 2)]).toBe(1);

    const s2 = finalScreen(D, { kind: 'about', reveal: 0.5 });
    expect(locate(s2, ' 2/4 ')).not.toBeNull();
    expect(glyph(s2, 4, 2)).not.toBe('┃');
    expect(glyph(s2, 4, 7)).toBe('┃');
    expect(alpha(s2, 5, 2)).toBeCloseTo(0.55, 6); // 'const' (önceki blok)
    expect(s2.fx[at(s2, 5, 2)]).toBe(0);
    expect(screenText(s2)).not.toContain('skills:');

    const s4 = finalScreen(D, { kind: 'about', reveal: 1 });
    expect(screenText(s4)).not.toContain('┃');
    expect(s4.fx.every((f) => f === 0)).toBe(true);
  });

  it('beceriler 50 sütuna sarılır, en fazla 6 satır', () => {
    const many: KodData = { ...D, skills: Array.from({ length: 30 }, (_, k) => `Beceri ${k}`) };
    const skills = aboutBlocks(many)[2] ?? [];
    expect(skills[0]).toBe('  skills: [');
    expect(skills.at(-1)).toBe('  ],');
    const body = skills.slice(1, -1);
    expect(body).toHaveLength(6);
    for (const l of body) expect([...l].length).toBeLessThanOrEqual(50);
    expect(body[0]).toMatch(/^ {4}'Beceri 0', 'Beceri 1',/);
  });

  it('reveal = 1: dosyanın tamamı tam opak (hiçbir blok sönük değil); açılış sürerken önceki bloklar söner', () => {
    const dimCells = (reveal: number) => {
      const s = finalScreen(D, { kind: 'about', reveal });
      let n = 0;
      for (let y = 1; y < KOD_ROWS - 1; y++)
        for (let x = 5; x < 55; x++) {
          const i = y * 56 + x;
          if ((s.g[i] ?? 0) > 0 && (s.fa[i] ?? 0) > 0 && (s.fa[i] ?? 0) <= 0.56) n++;
        }
      return n;
    };
    expect(dimCells(1)).toBe(0);
    expect(dimCells(0.5)).toBeGreaterThan(0);
  });
});

describe('alan diyagramları (§4.8.5)', () => {
  const area = (index: number) => finalScreen(D, { kind: 'area', index });

  it('her figür alanın başlığını yorum satırı olarak yazar; çerçeve başlığı, sol etiket ve k+1/N sayacı', () => {
    const want: Array<[string, string]> = [
      ['preview · iOS · Android', 'flutter'],
      ['tree lib', 'clean architecture'],
      ['api.log', 'http'],
      ['ci · flutter build', 'ci/cd'],
      ['arge.md', 'notes'],
    ];
    want.forEach(([title, left], k) => {
      const s = area(k);
      expect(locate(s, ` ${title} `), title).toEqual([10, 0]);
      expect(locate(s, ` ${left} `), left).toEqual([2, KOD_ROWS - 1]);
      expect(locate(s, ` ${k + 1}/5 `), title).toEqual([KOD_COLS - 7, KOD_ROWS - 1]);
      expect(textFrom(s, 2, 1)).toBe(`// ${D.areas[k]?.title}`);
      expect(role(s, 2, 1)).toBe(ROLE.subtle);
    });
  });

  it('phone: telefon çerçevesi; sağda ilk iki etiket, platform dalları ve not etiketlerden', () => {
    const s = area(0);
    expect(locate(s, `╭${'─'.repeat(16)}╮`)).toEqual([6, 3]);
    expect(locate(s, `╰${'─'.repeat(16)}╯`)).toEqual([6, 21]);
    expect(locate(s, '←── Flutter · Dart')).toEqual([26, 8]);
    expect(locate(s, '├─→ iOS')).toEqual([30, 9]);
    expect(locate(s, '└─→ Android')).toEqual([30, 10]);
    expect(locate(s, 'Material 3')).toEqual([30, 12]);
    expect(role(s, 30, 12)).toBe(ROLE.subtle);
  });

  it('tree: $ tree lib ve katman klasörleri; # notları alanın etiketlerinden', () => {
    const s = area(1);
    expect(locate(s, '$ tree lib')).toEqual([2, 3]);
    expect(locate(s, 'lib/')).toEqual([4, 5]);
    expect(textFrom(s, 4, 7)).toBe('├── presentation/       # MVVM');
    expect(textFrom(s, 4, 8)).toBe('│   └── state/          # Riverpod');
    expect(textFrom(s, 4, 10)).toBe('├── domain/             # Clean Architecture');
    expect(textFrom(s, 4, 12)).toBe('└── data/               # REST');
    expect([role(s, 28, 7), role(s, 28, 10), role(s, 28, 12)]).toEqual([
      ROLE.accent,
      ROLE.brass,
      ROLE.muted,
    ]);
    // eşleşen etiket yoksa not yazılmaz
    const bare = finalScreen(
      { ...D, areas: [{ ...D.areas[1]!, tags: [] }] },
      { kind: 'area', index: 0 },
    );
    expect(screenText(bare)).not.toContain('#');
    expect(locate(bare, '└── data/')).toEqual([4, 12]);
  });

  it('api: App ↔ API kutuları, istek (accent) ve 200 OK yanıtı (brass), tail -f logu etiketlerdeki protokollerle', () => {
    const s = area(2);
    expect(locate(s, 'App')).toEqual([5, 4]);
    expect(locate(s, 'API')).toEqual([47, 4]);
    expect(locate(s, 'GET /invoices · REST')).toEqual([18, 3]);
    expect(role(s, 18, 3)).toBe(ROLE.accent);
    expect(locate(s, '200 OK')).toEqual([25, 6]);
    expect(role(s, 25, 6)).toBe(ROLE.brass);
    expect(locate(s, '$ tail -f api.log')).toEqual([2, 9]);
    const log = Array.from({ length: 11 }, (_, k) => textFrom(s, 2, 10 + k));
    expect(log.filter((l) => l.startsWith('App → ')).length).toBeGreaterThan(3);
    expect(log.some((l) => /POST \/invoices +SOAP$/.test(l))).toBe(true);
    expect(log.some((l) => /GET {2}\/invoices +REST$/.test(l))).toBe(true);
    expect(log.filter((l) => l === 'API ← 200 OK').length).toBeGreaterThan(3);
  });

  it('pipeline: build → test → mağazalar kutuları ✓ ile biter; $ flutter build günlüğü ve yeni istem', () => {
    const s = area(3);
    expect(rowText(s, 4).indexOf('build')).toBe(6);
    expect(rowText(s, 4).indexOf('test')).toBe(18);
    expect(textFrom(s, 29, 4)).toMatch(/^App Store ✓ +│$/);
    expect(textFrom(s, 29, 5)).toMatch(/^Google Play ✓ +│$/);
    expect([glyph(s, 8, 5), role(s, 8, 5)]).toEqual(['✓', ROLE.brass]);
    expect(Array.from({ length: 6 }, (_, k) => textFrom(s, 2, 9 + k))).toEqual([
      '$ flutter build',
      '✓ build',
      '✓ test',
      '→ App Store ✓',
      '→ Google Play ✓',
      '$',
    ]);
    expect(bgAlpha(s, 4, 14)).toBeCloseTo(0.9, 6); // imleç
  });

  it('pipeline canlı: komut yazılır, aşamalar spinner ile başlar ve ✓ ile biter', () => {
    const s = new Screen();
    renderProgram(s, D, { kind: 'area', index: 3 }, 0.4, false);
    expect(textFrom(s, 2, 9)).toBe('$ flutter'); // ≈ 13 karakter / 0.5 s yazılıyor
    renderProgram(s, D, { kind: 'area', index: 3 }, 1.0, false);
    expect(textFrom(s, 2, 10)).toMatch(/^[|/\-\\] build$/); // spinner
    expect(screenText(s)).not.toContain('✓ test');
    renderProgram(s, D, { kind: 'area', index: 3 }, 3.5, false);
    expect(textFrom(s, 2, 13)).toBe('→ Google Play ✓');
  });

  it('list: yetenekler madde olarak (48 sütunda sarılır), etiketler # satırında', () => {
    const s = area(4);
    expect(textFrom(s, 2, 3)).toBe('- Hızlı prototipleme ve ölçüm odaklı deneyler');
    expect(textFrom(s, 2, 4)).toBe('  yürütüyorum.');
    expect(textFrom(s, 2, 6)).toBe('- Raporlama');
    expect(textFrom(s, 2, 8)).toBe('# Prototip · Ölçüm');
    expect(role(s, 2, 8)).toBe(ROLE.brass);
  });

  it('indeks sınırlanır; alan yoksa yalnız çerçeve', () => {
    expect(buffers(finalScreen(D, { kind: 'area', index: -1 }))).toEqual(buffers(area(0)));
    expect(buffers(finalScreen(D, { kind: 'area', index: 99 }))).toEqual(buffers(area(4)));
    const s = finalScreen(EMPTY, { kind: 'area', index: 0 });
    expect(locate(s, ' areas ')).toEqual([10, 0]);
    expect(rowText(s, KOD_ROWS - 1)).toBe(`╰${'─'.repeat(54)}╯`);
    for (let y = 1; y < KOD_ROWS - 1; y++) expect(rowText(s, y)).toBe(`│${' '.repeat(54)}│`);
  });

  it('list: durum satırı solu §4.8.5 tablosuyla aynı (notes)', () => {
    const k = D.areas.findIndex((a) => a.figure === 'list');
    const s = finalScreen(D, { kind: 'area', index: Math.max(0, k) });
    if (k >= 0) expect(rowText(s, KOD_ROWS - 1)).toContain(' notes ');
  });
});

describe('gitLogLayout (§4.10.3)', () => {
  const entry = (date: string): KodEntry => ({
    date,
    title: 'rol',
    at: '@ kurum',
    edu: false,
    current: false,
  });
  const ym = (m: number) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
  const months = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
  /** Tohumlu PRNG (mulberry32): rastgele ama tekrarlanabilir içerik */
  const prng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it('boş liste; tek kayıt üstte; iki kayıt üst ve alt sınırda (zamanla orantılı)', () => {
    expect(gitLogLayout([])).toEqual({ rows: [], years: [] });
    expect(gitLogLayout([entry('2024-05')])).toEqual({ rows: [3], years: [] });
    expect(gitLogLayout([entry('2024-05'), entry('2014-05')]).rows).toEqual([3, 19]);
    expect(gitLogLayout([entry('2024-05'), entry('2014-05')], 5, 15).rows).toEqual([5, 15]);
    expect(gitLogLayout([entry('2024-01'), entry('2020-01'), entry('2016-01')]).rows).toEqual([
      3, 11, 19,
    ]);
  });

  it('rastgele içerik (1–6 kayıt): satırlar artan, aralık ≥ 3, [top, bottom] içinde; çentikler commit satırına düşmez', () => {
    const rnd = prng(20261002);
    for (let run = 0; run < 400; run++) {
      const n = 1 + Math.floor(rnd() * 6);
      let m = 2026 * 12 + Math.floor(rnd() * 12);
      const es: KodEntry[] = [];
      for (let k = 0; k < n; k++) {
        es.push(entry(ym(m)));
        m -= Math.floor(rnd() * 40);
      }
      const { rows, years } = gitLogLayout(es);
      const ctx = es.map((e) => e.date).join(' ');
      expect(rows, ctx).toHaveLength(n);
      expect(rows[0], ctx).toBe(3);
      rows.slice(1).forEach((r, k) => expect(r - (rows[k] ?? 0), ctx).toBeGreaterThanOrEqual(3));
      expect(rows.at(-1) ?? 0, ctx).toBeLessThanOrEqual(19);
      const newest = months(es[0]!.date),
        oldest = months(es.at(-1)!.date);
      years.forEach(([r, label], k) => {
        expect(rows, ctx).not.toContain(r);
        expect(r, ctx).toBeGreaterThan(3);
        expect(r, ctx).toBeLessThanOrEqual(19);
        expect(Number(label) * 12, ctx).toBeGreaterThan(oldest);
        expect(Number(label), ctx).toBeLessThanOrEqual(Math.floor(newest / 12));
        years.slice(0, k).forEach(([q]) => expect(Math.abs(q - r), ctx).toBeGreaterThanOrEqual(2));
      });
    }
  });

  it('6 kayıttan fazlası [top, bottom]’a sığmaz: en az 3 satır aralık korunur, alt sınır aşılır', () => {
    for (const n of [7, 8]) {
      const { rows } = gitLogLayout(Array.from({ length: n }, (_, k) => entry(`${2025 - k}-01`)));
      rows.slice(1).forEach((r, k) => expect(r - (rows[k] ?? 0)).toBeGreaterThanOrEqual(3));
      expect(rows.at(-1)).toBe(3 + 3 * (n - 1));
    }
  });

  // HATA (programs.ts gitLogLayout): çentikler orantılı ölçekte hesaplanır, commit'ler ise en az 3 satır aralıkla aşağı
  // itilir. Yakın tarihli kayıtlarda eksen yalan söyler: [2023-01, 2022-11, 2010-01] → rows [3, 6, 19], "2022"
  // çentiği 4. satırda, yani 2022-11 commit'inin (6) ÜSTÜNDE.
  it('HATA: çentikler commit’lerle kronolojik tutarlıdır (itilen satırlarda bozulur)', () => {
    for (const dates of [
      ['2023-01', '2022-11', '2010-01'],
      ['2025-08', '2025-06', '2025-04', '2025-02', '2024-12', '2014-01'],
    ]) {
      const es = dates.map(entry);
      const { rows, years } = gitLogLayout(es);
      for (const [r, label] of years)
        es.forEach((e, k) => {
          if (months(e.date) >= Number(label) * 12) expect(rows[k], `${label}`).toBeLessThan(r);
          else expect(rows[k], `${label}`).toBeGreaterThan(r);
        });
    }
  });
});

describe('git log --graph (§4.10.3)', () => {
  const { rows, years } = gitLogLayout(D.journey);

  it('kayıtlar en yeniden eskiye: * (deneyim accent, eğitim brass), tarih + başlık, altında kurum', () => {
    const s = finalScreen(D, { kind: 'journey', active: -1 });
    expect(locate(s, ' git log --graph ')).toEqual([10, 0]);
    expect(locate(s, '$ git log --graph --date=short')).toEqual([2, 1]);
    D.journey.forEach((e, k) => {
      const y = rows[k] ?? -1;
      expect(glyph(s, 7, y)).toBe('*');
      expect(role(s, 7, y)).toBe(e.edu ? ROLE.brass : ROLE.accent);
      expect(locate(s, `${e.date} ${e.title}`)).toEqual([9, y]);
      expect(textFrom(s, 17, y + 1)).toBe(e.at);
    });
    // tek dal │ ilk commit'ten sonuncusuna
    for (let y = 3; y <= (rows.at(-1) ?? 3); y++) expect(glyph(s, 7, y)).toMatch(/[│┤*]/);
  });

  it('yıl çentikleri satır numarası sütununda, dal çizgisine bitişik (`2022 ─┤`)', () => {
    const s = finalScreen(D, { kind: 'journey', active: -1 });
    expect(years.length).toBeGreaterThan(0);
    for (const [y, yr] of years) expect(locate(s, `${yr} ─┤`)).toEqual([1, y]);
  });

  it('(HEAD) yalnız süren kayıtta: statikte sabit, canlıda nabız atar', () => {
    const s = finalScreen(D, { kind: 'journey', active: -1 });
    expect(count(s, '(HEAD)')).toBe(1);
    const [hx, hy] = locate(s, '(HEAD)') ?? [0, 0];
    expect(hy).toBe(rows[0]);
    expect(alpha(s, hx, hy)).toBe(1);
    const none = finalScreen(
      { ...D, journey: D.journey.map((e) => ({ ...e, current: false })) },
      { kind: 'journey', active: -1 },
    );
    expect(count(none, '(HEAD)')).toBe(0);
    const live = new Screen();
    const as: number[] = [];
    for (let t = 0; t < 3; t += 0.05) {
      renderProgram(live, D, { kind: 'journey', active: -1 }, t, false);
      as.push(alpha(live, hx, hy));
    }
    expect(Math.min(...as)).toBeGreaterThanOrEqual(0.4 - 1e-6);
    expect(Math.max(...as) - Math.min(...as)).toBeGreaterThan(0.5);
  });

  it('etkin kayıt: iki satır ≈ %17 accent zemin, başlık accent, fx = 1; sağ etiket k/E', () => {
    const s = finalScreen(D, { kind: 'journey', active: 1 });
    const y = rows[1] ?? -1;
    for (const yy of [y, y + 1])
      for (let x = 6; x <= KOD_COLS - 2; x++) {
        expect(s.br[at(s, x, yy)]).toBe(ROLE.accent);
        expect(bgAlpha(s, x, yy)).toBeCloseTo(0.17, 6);
      }
    const rowsWith = (a: ArrayLike<number>) => {
      const set = new Set<number>();
      for (let i = 0; i < a.length; i++) if ((a[i] ?? 0) > 0) set.add(Math.floor(i / KOD_COLS));
      return [...set];
    };
    expect(rowsWith(s.ba)).toEqual([y, y + 1]);
    expect(rowsWith(s.fx)).toEqual([y, y + 1]);
    expect(role(s, 17, y)).toBe(ROLE.accent);
    expect(role(s, 17, rows[0] ?? -1)).toBe(ROLE.ink);
    // E = deneyim sayısı (DOM girdileri); eğitim sayaçta yoktur
    const E = D.journey.filter((e) => !e.edu).length;
    expect(locate(s, ` 2/${E} `)).toEqual([KOD_COLS - 7, KOD_ROWS - 1]);
  });

  it('active = -1: vurgu yok, sağ etiket boş (statik panel, §4.10.8)', () => {
    const s = finalScreen(D, { kind: 'journey', active: -1 });
    expect(s.ba.every((a) => a === 0)).toBe(true);
    expect(s.fx.every((f) => f === 0)).toBe(true);
    expect(rowText(s, KOD_ROWS - 1)).toBe(`╰─ main ${'─'.repeat(KOD_COLS - 9)}╯`);
  });

  it('kayıt yoksa commit, tarih ve (HEAD) yazılmaz', () => {
    const s = finalScreen(EMPTY, { kind: 'journey', active: 0 });
    expect(textFrom(s, 2, 1)).toBe('$ git log --graph --date=short');
    expect(screenText(s)).not.toMatch(/[*@\d]|HEAD/);
    for (let y = 4; y < KOD_ROWS - 1; y++) expect(rowText(s, y)).toBe(`│${' '.repeat(54)}│`);
    expect(rowText(s, KOD_ROWS - 1)).toBe(`╰─ main ${'─'.repeat(KOD_COLS - 9)}╯`);
  });
});

describe('zsh: iletişim (§4.11.3)', () => {
  it('soluk geçmiş, mağaza satırı, # lead, $ mail <e-posta>, ✓ ve yeni istem', () => {
    const s = finalScreen(D, { kind: 'contact' });
    expect(locate(s, ' zsh ')).toEqual([10, 0]);
    expect(locate(s, ' İzmir · GMT+3 ')).toEqual([2, KOD_ROWS - 1]);
    expect(Array.from({ length: 12 }, (_, k) => textFrom(s, 2, k + 1))).toEqual([
      '$ flutter run lib/main.dart',
      '$ cat about.dart',
      '$ flutter build',
      '✓ App Store  ✓ Google Play',
      '$ git log --graph --date=short',
      '',
      '# Yeni bir proje için yazın; en geç iki gün içinde',
      '# dönüş yaparım.',
      '',
      '$ mail ada@example.com',
      '✓',
      '$',
    ]);
    expect([role(s, 2, 1), alpha(s, 2, 1)]).toEqual([ROLE.muted, expect.closeTo(0.38, 6)]);
    expect(role(s, 2, 7)).toBe(ROLE.subtle);
    expect([role(s, 2, 10), role(s, 4, 10), role(s, 9, 10)]).toEqual([
      ROLE.accent,
      ROLE.ink,
      ROLE.accent,
    ]);
    expect(role(s, 2, 11)).toBe(ROLE.brass);
    expect(bgAlpha(s, 4, 12)).toBeCloseTo(0.9, 6);
  });

  it('mağaza satırı yalnız içerikte mağaza bağlantısı varsa; tekrar eden mağaza bir kez', () => {
    const noStores = finalScreen(
      { ...D, projects: D.projects.map((p) => ({ ...p, stores: [] })) },
      { kind: 'contact' },
    );
    expect(textFrom(noStores, 2, 4)).toBe('$ git log --graph --date=short');
    expect(count(noStores, '✓')).toBe(1); // yalnız mail onayı
    const dup = finalScreen(
      {
        ...D,
        projects: [
          { ...D.projects[0]!, stores: ['App Store'] },
          { ...D.projects[1]!, stores: ['App Store'] },
        ],
      },
      { kind: 'contact' },
    );
    expect(textFrom(dup, 2, 4)).toBe('✓ App Store');
  });

  it('canlı: $ mail ≈ 45 ms/karakter yazılır, sonra ✓ basılır', () => {
    const s = new Screen();
    renderProgram(s, D, { kind: 'contact' }, 0.2, false);
    expect(textFrom(s, 2, 10)).toBe('$');
    renderProgram(s, D, { kind: 'contact' }, 0.35 + 10 * 0.045, false);
    expect(textFrom(s, 2, 10)).toBe('$ mail ada@e');
    expect(textFrom(s, 2, 11)).toBe('');
    renderProgram(s, D, { kind: 'contact' }, 0.35 + 20 * 0.045 + 0.46, false);
    expect(textFrom(s, 2, 11)).toBe('✓');
  });
});

describe('derin sayfa programları (§4.13.2, §4.13.6)', () => {
  it('folio: <slug>.yaml künyesi; yalnız projede olan alanlar', () => {
    const s = finalScreen(D, { kind: 'folio', slug: 'kasa' });
    expect(locate(s, ' kasa.yaml ')).toEqual([10, 0]);
    expect(locate(s, ' yaml · utf-8 ')).toEqual([2, KOD_ROWS - 1]);
    expect(rowText(s, KOD_ROWS - 1).indexOf(' 2024 ')).toBe(KOD_COLS - 8);
    expect(Array.from({ length: 11 }, (_, k) => textFrom(s, 5, k + 1))).toEqual([
      '# Kasa',
      'project: kasa',
      'role: Geliştirici',
      'year: 2024',
      'status: live',
      'areas: [mobil, yayin]',
      'facts:',
      '  Kullanıcı: 10K',
      'stores:',
      '  - App Store',
      '  - Google Play',
    ]);
    expect(textFrom(s, 1, 11)).toMatch(/^ 11 /);
    expect([role(s, 5, 2), role(s, 14, 2), role(s, 9, 10)]).toEqual([
      ROLE.brass,
      ROLE.ink,
      ROLE.accent,
    ]);
    const bare = finalScreen(
      { ...D, projects: [{ ...D.projects[1]!, areas: [] }] },
      { kind: 'folio', slug: 'rota' },
    );
    const text = screenText(bare);
    for (const key of ['facts:', 'stores:', 'areas:']) expect(text).not.toContain(key);
    expect(text).toContain('status: done');
  });

  it('folio: bilinmeyen slug ilk projeye düşer; proje yoksa yalnız çerçeve', () => {
    expect(buffers(finalScreen(D, { kind: 'folio', slug: 'olmayan' }))).toEqual(
      buffers(finalScreen(D, { kind: 'folio', slug: 'kasa' })),
    );
    const s = finalScreen(EMPTY, { kind: 'folio', slug: 'olmayan' });
    expect(locate(s, ' olmayan.yaml ')).toEqual([10, 0]);
    for (let y = 1; y < KOD_ROWS - 1; y++) expect(rowText(s, y)).toBe(`│${' '.repeat(54)}│`);
  });

  it('next: cd ../<slug> ve künyenin ilk satırları', () => {
    const s = finalScreen(D, { kind: 'next', slug: 'rota' });
    expect(locate(s, ' projects/ ')).toEqual([2, KOD_ROWS - 1]);
    expect(Array.from({ length: 9 }, (_, k) => textFrom(s, 2, k + 2))).toEqual([
      '$ cd ../rota',
      '$ head -4 project.yaml',
      '',
      '# Rota',
      'project: rota',
      'role: Lider',
      'year: 2022',
      '',
      '$',
    ]);
  });

  it('list: $ ls projects/ — satır başına slug, yıl ve birincil alan; sayaç öğe sayısı', () => {
    const s = finalScreen(D, { kind: 'list', filter: null });
    expect(textFrom(s, 2, 2)).toBe('$ ls projects/');
    // sütunlar: slug 4 (genişlik 13 = en uzun slug + 2), yıl 18, birincil alan 24
    expect([4, 6, 8].map((y) => textFrom(s, 2, y))).toEqual([
      `▸ ${'kasa/'.padEnd(14)}2024  mobil`,
      `▸ ${'rota/'.padEnd(14)}2022  servis`,
      `▸ ${'not-defteri/'.padEnd(14)}2021  mobil`,
    ]);
    expect(textFrom(s, 2, 10)).toBe('$');
    expect(locate(s, ' 3 öğe ')).not.toBeNull();
    expect(locate(finalScreen(D_EN, { kind: 'list', filter: null }), ' 3 items ')).not.toBeNull();
  });

  it('list filtresi: --area=<id> yazılır, eşleşmeyen satırlar söner (saydamlık 0.3, ▸ yok)', () => {
    const s = finalScreen(D, { kind: 'list', filter: 'mobil' });
    expect(textFrom(s, 2, 2)).toBe('$ ls projects/ --area=mobil');
    expect(locate(s, ' 2 öğe ')).not.toBeNull();
    const rowsOf = [4, 6, 8];
    const on = rowsOf.map((y) => glyph(s, 2, y) === '▸');
    expect(on).toEqual([true, false, true]);
    expect(rowsOf.map((y) => alpha(s, 4, y))).toEqual([1, expect.closeTo(0.3, 6), 1]);
    expect(rowsOf.map((y) => alpha(s, 19, y))).toEqual([1, expect.closeTo(0.3, 6), 1]); // yıl
    expect(locate(finalScreen(D, { kind: 'list', filter: 'olmayan' }), ' 0 öğe ')).not.toBeNull();
  });

  it('notfound: $ open <yol>, 404 hatası, yığın satırları ve verilen bağlantılar', () => {
    const s = finalScreen(D, { kind: 'notfound', path: '/olmayan/sayfa' }, LINKS);
    expect(locate(s, ' zsh ')).toEqual([10, 0]);
    expect(rowText(s, KOD_ROWS - 1).indexOf(' 404 ')).toBe(2);
    expect(Array.from({ length: 12 }, (_, k) => textFrom(s, 2, k + 2))).toEqual([
      '$ open /olmayan/sayfa',
      '',
      'Error: 404 · sayfa bulunamadı',
      "  at Router.resolve ('/olmayan/sayfa')",
      '  at Site.navigate',
      '',
      '# Önerilen:',
      `→ ${'/'.padEnd(20)}Ana sayfa`,
      `→ ${'/projeler'.padEnd(20)}Projeler`,
      `→ ${'/iletisim'.padEnd(20)}İletişim`,
      '',
      '$',
    ]);
    expect(role(s, 24, 9)).toBe(ROLE.brass);
    const en = finalScreen(D_EN, { kind: 'notfound', path: '/x' }, LINKS);
    expect(screenText(en)).toContain('Error: 404 · page not found');
    expect(screenText(en)).toContain('# Try:');
    const bare = finalScreen(D, { kind: 'notfound', path: '/x' });
    expect(screenText(bare)).not.toContain('→');
    expect(textFrom(bare, 2, 10)).toBe('$');
  });

  it('programKey her tür için', () => {
    const keys: Array<[KodProgram, string]> = [
      [{ kind: 'hero' }, 'hero'],
      [{ kind: 'about', reveal: 1 }, 'about:1'],
      [{ kind: 'about', reveal: 0.5 }, 'about:0.5'],
      [{ kind: 'area', index: 2 }, 'area:2'],
      [{ kind: 'journey', active: -1 }, 'journey:-1'],
      [{ kind: 'journey', active: 3 }, 'journey:3'],
      [{ kind: 'contact' }, 'contact'],
      [{ kind: 'folio', slug: 'kasa' }, 'folio:kasa'],
      [{ kind: 'next', slug: 'rota' }, 'next:rota'],
      [{ kind: 'list', filter: null }, 'list:'],
      [{ kind: 'list', filter: 'mobil' }, 'list:mobil'],
      [{ kind: 'notfound', path: '/x/y' }, 'notfound:/x/y'],
    ];
    for (const [p, key] of keys) expect(programKey(p)).toBe(key);
    // farklı programlar farklı anahtar taşır (WebGL değişimi algılar)
    const all = programs(D).filter((p) => !(p.kind === 'area' && (p.index < 0 || p.index > 4)));
    expect(new Set(all.map(programKey)).size).toBe(all.length);
  });
});

describe('fit / wrapText', () => {
  it('fit n kod noktasını aşmaz, taşarsa "…" ile biter', () => {
    expect(fit('abc', 3)).toBe('abc');
    expect(fit('abcd', 3)).toBe('ab…');
    expect(fit('İstanbul', 4)).toBe('İst…');
    expect(fit('😀😀😀', 2)).toBe('😀…');
    for (let n = 1; n < 12; n++) expect([...fit(long(40), n)].length).toBe(n);
  });

  it('wrapText kelime sınırında W sütuna böler, boşlukları sadeleştirir', () => {
    expect(wrapText('', 10)).toEqual([]);
    expect(wrapText('  bir   iki üç  ', 7)).toEqual(['bir iki', 'üç']);
    const out = wrapText(long(120), 48);
    for (const l of out) expect([...l].length).toBeLessThanOrEqual(48);
    expect(out.join(' ')).toBe(long(120).trim().split(/\s+/).join(' '));
  });
});

describe('K-KOD-5: içerikte olmayan olgu yazılmaz (§4.1.2)', () => {
  /** Kod süsü: Dart iskeleti, git/zsh, hata yığını, kutu ve protokol etiketleri (§4.1.2, §4.8.5) */
  const DECOR = new Set([
    'Portfolio',
    'runApp',
    'StatelessWidget',
    'Widget',
    'BuildContext',
    'Profile',
    'Text',
    'Developer',
    'Ln',
    'Col',
    'Hakkımda',
    'About',
    'App',
    'API',
    'GET',
    'POST',
    'OK',
    'HEAD',
    'Error',
    'Router',
    'Site',
    'Önerilen',
    'Try',
  ]);
  const words = (text: string) => text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const known = (d: KodData, extra?: NotFoundLinks) =>
    new Set(words(JSON.stringify([d, extra?.links ?? []])));

  it.each([
    ['TR', D],
    ['EN', D_EN],
  ] as const)(
    '%s: büyük harfli her sözcük (özel ad, kurum) ve her yıl içerikten ya da kod süsünden',
    (_, d) => {
      const ok = known(d, LINKS);
      const journeyYears = d.journey.map((e) => Number(e.date.slice(0, 4)));
      const strangers: string[] = [];
      for (const p of programs(d))
        for (const age of [0, 1.3, 3.5, 99])
          for (const reduce of [false, true]) {
            const s = new Screen();
            renderProgram(s, d, p, age, reduce, LINKS);
            for (const w of words(screenText(s))) {
              const year = /^(19|20)\d{2}$/.test(w);
              const tick =
                year &&
                p.kind === 'journey' &&
                Number(w) > Math.min(...journeyYears) &&
                Number(w) <= Math.max(...journeyYears);
              if ((year || /\p{Lu}/u.test(w)) && !ok.has(w) && !DECOR.has(w) && !tick)
                strangers.push(`${programKey(p)}: ${w}`);
            }
          }
      expect([...new Set(strangers)]).toEqual([]);
    },
  );

  // HATA (programs.ts FIGURE_TITLE.phone): etiketlerde iOS ya da Android'den biri varsa başlık her zaman
  // "preview · iOS · Android" yazar; §4.8.5 "preview · <platformlar>" ister. tags ['Kotlin', 'Android'] → 'iOS' yazılır.
  it('HATA: phone başlığı yalnız etiketlerdeki platformları yazar', () => {
    const a: KodArea = { ...D.areas[0]!, tags: ['Kotlin', 'Android'] };
    const s = finalScreen({ ...D, areas: [a] }, { kind: 'area', index: 0 });
    expect(rowText(s, 0)).toContain('preview · Android');
    expect(screenText(s)).not.toContain('iOS');
  });

  // HATA (programs.ts figPipeline): mağaza etiketi yoksa ['App Store', 'Google Play'] varsayılır; §4.8.5 "mağaza adları
  // alanın tags'inden", §4.1.2 içerikte olmayan olguyu YASAKLAR.
  it('HATA: pipeline mağaza adlarını yalnız etiketlerden yazar', () => {
    const a: KodArea = { ...D.areas[3]!, tags: ['CI/CD'] };
    const s = finalScreen({ ...D, areas: [a] }, { kind: 'area', index: 0 });
    expect(screenText(s)).not.toMatch(/App Store|Google Play/);
  });

  // HATA (programs.ts figApi): protokol etiketi yoksa ['REST'] varsayılır; ayrıca iki protokolde ilk log satırı negatif
  // mod yüzünden (types[-1] → undefined → 'REST') etiketlerde olmayan REST'i yazar: tags ['SOAP', 'GraphQL'].
  it('HATA: api yalnız etiketlerdeki protokolleri yazar', () => {
    for (const tags of [['Veri modelleme'], ['SOAP', 'GraphQL']]) {
      const a: KodArea = { ...D.areas[2]!, tags };
      const s = finalScreen({ ...D, areas: [a] }, { kind: 'area', index: 0 });
      expect(screenText(s), tags.join()).not.toContain('REST');
    }
  });
});

describe('bilinen hatalar: ızgara sınırı (atlandı, kaynak düzeltilene dek)', () => {
  // HATA (programs.ts wrapList/aboutBlocks): tek bir beceri ~43 karakteri aşınca satır W = 50'yi aşar ve x = 5'ten
  // yazılınca sağ kenar çizgisini (x = 55) ezer. Gerçek EN içerik tetikler: "App Store and Google Play release
  // management" (44) → "    'App Store and Google Play release management'," (51 sütun), ',' çerçeveye düşer.
  // Aynı sınıf: `const ${varName} = Developer(` de fit() edilmez (varName > 31 karakter).
  it('HATA: about.dart uzun beceriyle çerçeveyi ezmez', () => {
    const d: KodData = {
      ...D_EN,
      skills: ['Flutter', 'Dart', 'App Store and Google Play release management'],
    };
    expect(audit(d, { kind: 'about', reveal: 1 }, 99, true)).toEqual([]);
    expect(
      audit({ ...d, varName: 'v'.repeat(40) }, { kind: 'about', reveal: 1 }, 99, true),
    ).toEqual([]);
  });

  // HATA (programs.ts rJourney/gitLogLayout): 8+ kayıtta son satırlar 24'ü aşar; dal çizgisi alt çerçeveyi ezer
  // ((7, 23) '│'), sığmayan kayıtlar sessizce düşer. §4.10.3: "24 satıra sığmayan en eski kayıtlar … ile kısalır".
  it('HATA: git log 8+ kayıtta çerçeveyi ezmez, sığmayanları … ile kısaltır', () => {
    const journey = Array.from({ length: 8 }, (_, k): KodEntry => ({
      date: `${2025 - k}-01`,
      title: `Rol ${k}`,
      at: `@ Kurum ${k}`,
      edu: false,
      current: k === 0,
    }));
    const d: KodData = { ...D, journey };
    expect(audit(d, { kind: 'journey', active: -1 }, 99, true)).toEqual([]);
    expect(screenText(finalScreen(d, { kind: 'journey', active: -1 }))).toContain('…');
  });

  // HATA (programs.ts rJourney): (HEAD) yalnız `x + 7 < cols − 1` iken yazılır; başlık fit(32) ile kısaltıldığı için
  // ≥ 31 karakterlik süren rolde (HEAD) hiç görünmez. §4.10.3: "(HEAD) süren güncel rolde yazılır".
  it('HATA: uzun başlıklı süren rolde de (HEAD) yazılır', () => {
    const d: KodData = {
      ...D,
      journey: [{ ...D.journey[0]!, title: 'Principal Mobile Platform Engineer' }],
    };
    expect(count(finalScreen(d, { kind: 'journey', active: -1 }), '(HEAD)')).toBe(1);
  });
});
