// src/stage/anchors.test.ts — ANCHORS kaydı (§5.7.3), ölçüm (§5.7.4), ekran dikdörtgeni ve ölçek (§5.7.5,
// anchor-screen.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { footprintRadius } from '@/lib/section-geometry';
import { anchorScreen, stoneScale } from './anchor-screen';
import { ANCHORS, measureAnchors, PAGE_FOLIO_SIZE, type MeasuredAnchor } from './anchors';

describe('ANCHORS (§5.7.3)', () => {
  it('kimlik anahtarla aynı; mobil boyut 0.86; yalnız hero kuralı', () => {
    for (const [id, def] of Object.entries(ANCHORS)) {
      expect(def.id).toBe(id);
      expect(def.sizeMobile).toBe(0.86);
      expect(def.size).toBeGreaterThan(0);
      expect(def.size).toBeLessThanOrEqual(1);
    }
    expect(
      Object.values(ANCHORS)
        .filter((a) => a.rule === 'hero')
        .map((a) => a.id),
    ).toEqual(['hero-rest']);
    expect(ANCHORS['work-specimen'].kindMobile).toBeNull();
    expect(ANCHORS['cv-core'].kindMobile).toBeNull();
  });

  it('page-folio preset boyutları; folio varsayılanı kayıtla aynı', () => {
    expect(PAGE_FOLIO_SIZE.folio).toBe(ANCHORS['page-folio'].size);
    expect(Object.values(PAGE_FOLIO_SIZE).every((s) => s > 0 && s <= 1)).toBe(true);
  });
});

describe('stoneScale (§5.7.5)', () => {
  // neutral: n1 = 2.2 → R0 = 1.0320; 1440×900
  const R0 = footprintRadius([1, 0.86, 1], 2.2);
  it('K0 (D 362, r 5.2, fov 30) → 0.543 ve K2 (D 515, r 7.2, fov 18) → 0.632 (±0.001)', () => {
    expect(R0).toBeCloseTo(1.032, 3);
    expect(Math.abs(stoneScale(362, 5.2, 30, R0, 900) - 0.543)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(stoneScale(515, 7.2, 18, R0, 900) - 0.632)).toBeLessThanOrEqual(0.001);
  });
  it('dolly-zoom: r·tan(fov/2) sabitken ölçek sabit', () => {
    const a = stoneScale(400, 4.6, 28, 1, 900);
    const r2 = (4.6 * Math.tan((14 * Math.PI) / 180)) / Math.tan((9 * Math.PI) / 180);
    expect(stoneScale(400, r2, 18, 1, 900)).toBeCloseTo(a, 6);
  });
});

describe('anchorScreen (§5.7.5)', () => {
  const base = { slot: 0, size: 0.8, align: 'center' as const, left: 100, width: 400, height: 300 };
  it('flow: belgeyle kayar; D = size·min(w, h)', () => {
    const a: MeasuredAnchor = { ...base, id: 'about-cut', kind: 'flow', docTop: 1000 };
    expect(anchorScreen(a, 0, 0.8)).toEqual({ cx: 300, cy: 1150, D: 240 });
    expect(anchorScreen(a, 700, 0.8).cy).toBe(450);
  });
  it('hero kuralı ve alta hizalama: D = min(0.68·w, h − 24); cy = alt − 0.5·D·ry', () => {
    const a: MeasuredAnchor = {
      ...base,
      id: 'hero-rest',
      kind: 'flow',
      align: 'bottom',
      rule: 'hero',
      docTop: 80,
    };
    const r = anchorScreen(a, 0, 0.775);
    expect(r.D).toBeCloseTo(Math.min(0.68 * 400, 300 - 24), 6);
    expect(r.cy).toBeCloseTo(80 + 300 - 0.5 * r.D * 0.775, 6);
  });
  it('viewport: bölüme göre sabit ekran konumu', () => {
    const a: MeasuredAnchor = {
      ...base,
      id: 'contact-ring',
      kind: 'viewport',
      docTop: 9000,
      chapterOffsetTop: 126,
    };
    expect(anchorScreen(a, 0, 0.8).cy).toBe(126 + 150);
    expect(anchorScreen(a, 5000, 0.8).cy).toBe(126 + 150);
  });
  it('sticky: doğal konum → yapışık → kapsayıcı sonunda bırakır', () => {
    const a: MeasuredAnchor = {
      ...base,
      id: 'areas-dial',
      kind: 'sticky',
      docTop: 2117, // doğal durumda sahne üstü 2000 + 117
      sticky: { naturalDocTop: 2000, top: 0, height: 900, containerDocBottom: 4880 },
    };
    const top = (y: number) => anchorScreen(a, y, 0.8).cy - 150;
    expect(top(1500)).toBe(500 + 117); // henüz yapışmadı
    expect(top(2500)).toBe(117); // yapışık (top 0)
    expect(top(4500)).toBe(4880 - 4500 - 900 + 117); // kapsayıcı sonu
  });
  it('out nesnesine yazar (bellek ayırmaz)', () => {
    const out = { cx: 0, cy: 0, D: 0 };
    const a: MeasuredAnchor = { ...base, id: 'about-cut', kind: 'flow', docTop: 0 };
    expect(anchorScreen(a, 0, 0.8, out)).toBe(out);
  });
});

describe('measureAnchors (§5.7.4)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  const rect = (top: number, left: number, w: number, h: number) =>
    ({
      top,
      left,
      width: w,
      height: h,
      bottom: top + h,
      right: left + w,
      x: left,
      y: top,
    }) as DOMRect;

  it('flow, viewport ve sticky ölçülür; görünmeyen ve mobilde null tür atlanır', () => {
    document.body.innerHTML = `
      <section data-chapter="about"><div data-stage-anchor="about-cut" data-anchor-size="0.72"></div></section>
      <section data-chapter="areas"><div class="stage" style="position: sticky; top: 0px">
        <div data-stage-anchor="areas-dial"></div></div></section>
      <section data-chapter="work"><div data-stage-anchor="work-specimen"></div></section>
      <section data-chapter="contact"><div data-stage-anchor="contact-ring"></div></section>`;
    const at = (sel: string) => document.querySelector<HTMLElement>(sel)!;
    vi.spyOn(at('[data-stage-anchor="about-cut"]'), 'getBoundingClientRect').mockReturnValue(
      rect(500, 800, 533, 533),
    );
    vi.spyOn(at('[data-stage-anchor="areas-dial"]'), 'getBoundingClientRect').mockReturnValue(
      rect(2117, 732, 644, 729),
    );
    vi.spyOn(at('.stage'), 'getBoundingClientRect').mockReturnValue(rect(2000, 0, 1440, 900));
    vi.spyOn(at('[data-chapter="areas"]'), 'getBoundingClientRect').mockReturnValue(
      rect(2000, 0, 1440, 2880),
    );
    vi.spyOn(at('[data-stage-anchor="work-specimen"]'), 'getBoundingClientRect').mockReturnValue(
      rect(0, 0, 0, 0),
    );
    vi.spyOn(at('[data-stage-anchor="contact-ring"]'), 'getBoundingClientRect').mockReturnValue(
      rect(9126, 1066, 533, 648),
    );
    vi.spyOn(at('[data-chapter="contact"]'), 'getBoundingClientRect').mockReturnValue(
      rect(9000, 0, 1440, 900),
    );
    const list = measureAnchors(document, false);
    expect(list.map((a) => a.id)).toEqual(['about-cut', 'areas-dial', 'contact-ring']);
    expect(list[0]).toMatchObject({ kind: 'flow', size: 0.72, docTop: 500, left: 800 });
    expect(list[1]).toMatchObject({
      kind: 'sticky',
      sticky: { naturalDocTop: 2000, top: 0, height: 900, containerDocBottom: 4880 },
    });
    expect(list[2]).toMatchObject({ kind: 'viewport', chapterOffsetTop: 126 });
    expect(at('.stage').style.position).toBe('sticky'); // satır içi static geri alındı
    // mobil: work-specimen kindMobile null; contact-ring flow; hizalama center
    const mobile = measureAnchors(document, true);
    expect(mobile.find((a) => a.id === 'contact-ring')).toMatchObject({ kind: 'flow', size: 0.86 });
  });

  it('sticky: absolute çapa ofseti sticky hâlde ölçülür (static belgeye göre yerleştirir)', () => {
    document.body.innerHTML = `
      <section data-chapter="areas"><div class="stage" style="position: sticky; top: 0px">
        <div data-stage-anchor="areas-dial" style="position: absolute"></div></div></section>`;
    const stage = document.querySelector<HTMLElement>('.stage')!;
    const dial = document.querySelector<HTMLElement>('[data-stage-anchor]')!;
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(rect(2000, 0, 1440, 900));
    // static'te kapsayıcı blok belgeye döner: top 13svh → 117 (hatalı değer)
    vi.spyOn(dial, 'getBoundingClientRect').mockImplementation(() =>
      stage.style.position === 'static' ? rect(117, 732, 644, 729) : rect(2117, 732, 644, 729),
    );
    const [a] = measureAnchors(document, false);
    expect(a).toMatchObject({ id: 'areas-dial', docTop: 2117, sticky: { naturalDocTop: 2000 } });
  });
});
