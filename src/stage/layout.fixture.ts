// src/stage/layout.fixture.ts — YALNIZ TEST (tracks/events testleri): içerik sayılarından DOM'suz sentetik Layout.
// measureLayout'un (§5.9.3) anlamını izler: IN(i) = [top − vh, top], BODY(i) = [top, top + h − vh], uçlar
// [0, maxScroll]'a kırpılır; order = DOM indeksi·2 (+1 BODY); hero'nun fazı yok; aktivasyon = üst − 0.55·vh;
// heroExit = about IN p 0.30; areas yalnız pin varken { bodyY0, bodyLen, S, N }. Yükseklikler svh'dir (1 svh = vh/100).
// Masaüstü §4.5.2'dir: about 140, areas 120 + 50N (pin), work 30 + 70P + 20, journey 40 + 35E + 30, contact 100.
// Kapı dışı bölümler (mobil, liste, yatay telefon) doğal yüksekliktedir; GEO'daki değerler makul varsayımlardır.
// tracks.test.ts, aynı geometriyle kurulan DOM'da measureLayout'un bu Layout'u ürettiğini doğrular.
import { vi } from 'vitest';
import type { StageData } from './store';
import { AREAS_STEP, type ChapterId, type Layout, type PhaseRange } from './tracks';

export type FixtureVariant = 'desktop' | 'mobile' | 'mobile-list' | 'landscape';

export interface FixtureSpec {
  variant: FixtureVariant;
  /** alan sayısı; ≥ 7 → liste modu: sectors 0 ve proje alanları null (getStageData gibi) */
  N: number;
  P: number;
  E: number;
  testimonials?: boolean;
  /** kısa görüntü alanı: masaüstü 700 (< 760 → shortViewport), mobil 667, yatay 360 */
  short?: boolean;
  /** öne çıkan projelerin alanları (eksik olan null); verilmezse k mod N */
  areas?: readonly (number | null)[];
  /** contact yüksekliği (svh); < 100 ise K5'e ancak maxScroll kırpmasıyla ulaşılır */
  contactH?: number;
}

export interface Fixture {
  layout: Layout;
  data: StageData;
  /** svh → belge px */
  px: (svh: number) => number;
  /** bölüm üstleri (svh) */
  top: Readonly<Partial<Record<ChapterId, number>>>;
  /** bölümler DOM sırasıyla (svh) */
  sections: ReadonlyArray<{ id: ChapterId; top: number; h: number }>;
  /** work makalelerinin ve journey girdilerinin üstleri (svh) */
  items: { work: readonly number[]; journey: readonly number[] };
  /** pin koşulu (sticky sahne ve data-areas-n 3–6) */
  pinned: boolean;
}

/** [normal, kısa] innerHeight (px) */
const VH: Readonly<Record<FixtureVariant, readonly [number, number]>> = {
  desktop: [900, 700],
  mobile: [844, 667],
  'mobile-list': [844, 667],
  landscape: [390, 360],
};

type Blocks = readonly [head: number, item: number, tail: number];
interface Geo {
  about: number;
  list: readonly [base: number, perArea: number]; // pinsiz areas
  work: Blocks; // başlık bloğu, makale, kapanış
  journey: Blocks; // başlık bloğu, girdi, CTA
  testimonials: number;
  contact: number;
}

// Masaüstü work/journey svh kapılıdır (§4.5.2); mobil: 16:10 kapak + metin ≈ 95 svh makale, 36 svh bant + başlık,
// 30 svh girdi; yatay telefon (390 px yükseklik): aynı içerik svh cinsinden ≈ 2–3 kat uzundur.
// prettier-ignore
const GEO: Readonly<Record<'desktop' | 'mobile' | 'landscape', Geo>> = {
  desktop:   { about: 140, list: [60, 45],  work: [30, 70, 20],  journey: [40, 35, 30], testimonials: 120, contact: 100 },
  mobile:    { about: 170, list: [60, 60],  work: [30, 95, 20],  journey: [56, 30, 34], testimonials: 160, contact: 130 },
  landscape: { about: 300, list: [80, 120], work: [40, 200, 20], journey: [60, 70, 40], testimonials: 300, contact: 250 },
};

export function buildFixture(spec: FixtureSpec): Fixture {
  const { variant, N, P, E } = spec;
  const vh = VH[variant][spec.short ? 1 : 0];
  const g = GEO[variant === 'mobile-list' ? 'mobile' : variant];
  const S = variant === 'desktop' ? AREAS_STEP.desktop : AREAS_STEP.mobile;
  const listMode = N >= 7;
  // pin: 3 ≤ N ≤ 6; mobilde metin 58 svh'ye sığmalı (mobile-list sığmıyor) ve innerHeight ≥ 600 (yatay değil)
  const pinned = !listMode && (variant === 'desktop' || variant === 'mobile');
  const px = (s: number) => (s * vh) / 100;

  const heights: ReadonlyArray<readonly [ChapterId, number]> = [
    ['hero', 100],
    ['about', g.about],
    ['areas', pinned ? 120 + S * N : g.list[0] + g.list[1] * N],
    ['work', g.work[0] + g.work[1] * P + g.work[2]],
    ['journey', g.journey[0] + g.journey[1] * E + g.journey[2]],
    ...(spec.testimonials ? [['testimonials', g.testimonials] as const] : []),
    ['contact', spec.contactH ?? g.contact],
  ];
  let doc = 0;
  const sections = heights.map(([id, h]) => {
    const s = { id, top: doc, h };
    doc += h;
    return s;
  });
  const top: Partial<Record<ChapterId, number>> = Object.fromEntries(
    sections.map((s) => [s.id, s.top]),
  );
  const T = top as Record<ChapterId, number>;
  const items = {
    work: Array.from({ length: P }, (_, k) => T.work + g.work[0] + g.work[1] * k),
    journey: Array.from({ length: E }, (_, k) => T.journey + g.journey[0] + g.journey[1] * k),
  };

  const maxScroll = Math.max(0, px(doc) - vh);
  const clamp = (y: number) => Math.min(Math.max(y, 0), maxScroll);
  const phases: PhaseRange[] = sections.flatMap(({ id: chapter, top: t, h }, i): PhaseRange[] => {
    if (chapter === 'hero') return [];
    const y = px(t);
    return [
      { chapter, phase: 'in', y0: clamp(y - vh), y1: clamp(y), order: i * 2 },
      {
        chapter,
        phase: 'body',
        y0: clamp(y),
        y1: clamp(Math.max(y, y + px(h) - vh)),
        order: i * 2 + 1,
      },
    ];
  });
  const [aboutIn, , , areasBody] = phases as [PhaseRange, PhaseRange, PhaseRange, PhaseRange];
  const line = (s: number) => px(s) - 0.55 * vh; // "top 55%"
  const area = (k: number) => (listMode ? null : spec.areas ? (spec.areas[k] ?? null) : k % N);

  return {
    px,
    top,
    sections,
    items,
    pinned,
    layout: {
      vh,
      maxScroll,
      mobile: variant !== 'desktop',
      phases,
      anchors: [],
      activation: { work: items.work.map(line), journey: items.journey.map(line), cv: [] },
      areas: pinned ? { bodyY0: areasBody.y0, bodyLen: areasBody.y1 - areasBody.y0, S, N } : null,
      heroExit: aboutIn.y0 + 0.3 * (aboutIn.y1 - aboutIn.y0),
    },
    data: {
      rings: 12,
      sectors: listMode ? 0 : N,
      projects: Array.from({ length: P }, (_, k) => ({
        slug: `proje-${k + 1}`,
        area: area(k),
        band: [k, k + 2] as const,
      })),
      entries: Array.from({ length: E }, (_, k) => ({ band: [10 - k, 11 - k] as const })),
    },
  };
}

/** Fixture geometrisiyle jsdom DOM'u kurar; ölçüm yalnız bunları okur (getBoundingClientRect, offsetHeight, …). */
export function mountFixture(
  fx: Fixture,
  o: { sticky?: boolean; n?: number | null; scrollY?: number } = {},
) {
  const scrollY = o.scrollY ?? 0;
  const last = fx.sections[fx.sections.length - 1];
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(fx.layout.vh);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(scrollY);
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
    fx.px((last?.top ?? 0) + (last?.h ?? 0)),
  );
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: !fx.layout.mobile, media: q }));
  const place = <E extends HTMLElement>(el: E, s: number): E => {
    el.getBoundingClientRect = () => ({ top: fx.px(s) - scrollY }) as DOMRect;
    return el;
  };
  const root = document.createElement('div');
  root.dataset.stageScope = '';
  for (const { id, top, h } of fx.sections) {
    const sec = place(document.createElement('section'), top);
    sec.dataset.chapter = id;
    Object.defineProperty(sec, 'offsetHeight', { configurable: true, value: fx.px(h) });
    if (id === 'areas') {
      const n = o.n === undefined ? (fx.layout.areas?.N ?? 4) : o.n;
      if (n !== null) sec.dataset.areasN = String(n);
      const stage = document.createElement('div');
      stage.dataset.areasStage = '';
      if (o.sticky ?? fx.pinned) stage.style.position = 'sticky';
      sec.append(stage);
    }
    if (id === 'work')
      for (const s of fx.items.work) {
        const a = place(document.createElement('article'), s);
        a.dataset.workArticle = '';
        sec.append(a);
      }
    if (id === 'journey') {
      const ol = document.createElement('ol');
      for (const s of fx.items.journey) {
        const li = place(document.createElement('li'), s);
        li.dataset.journeyEntry = '';
        ol.append(li);
      }
      sec.append(ol);
    }
    root.append(sec);
  }
  document.body.replaceChildren(root);
  return root;
}
