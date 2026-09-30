// src/components/figures/figures.test.tsx — SVG figürleri (§6.6.5, §4.16.3, §10.4.4): erişilebilirlik, dilim ve bant
// kancaları (data-sector / data-band / data-active), --dial-rot dönüşü, ArcFigure'ın SSR'da yaysız ve hidrasyon güvenli oluşu.
import { act, cleanup, render, screen } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NO_BAND,
  arcFraction,
  arcPath,
  psiDeg,
  ringRadius,
  sectorPath,
} from '@/lib/section-geometry';
import { ArcFigure } from './ArcFigure';
import { DialFigure, dialRotation } from './DialFigure';
import { EntryGlyph } from './EntryGlyph';
import { RingsFigure } from './RingsFigure';
import { SpecimenGlyph } from './SpecimenGlyph';
import { C, R_FIGURE, R_GLYPH, SIZE, bandGeometry, r2, visibleRings } from './figure-style';

const DIAL_LABEL = 'Çalışma alanları: A, B, C, D';
const RINGS_LABEL = 'Kariyer halkaları: 2014 – 2026';

function one<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`bulunamadı: ${selector}`);
  return el;
}

const attrs = (els: Iterable<Element>, name: string) => [...els].map((el) => el.getAttribute(name));

/** Yalnız Date sahtelenir: React'in zamanlayıcıları gerçek kalır. */
function freezeDate(d: Date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(d);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DialFigure', () => {
  it('dial: role="img" + verilen aria-label; N kama (sectorPath), tek data-active, N etiket', () => {
    const { container } = render(<DialFigure n={4} ariaLabel={DIAL_LABEL} rings={12} />);
    const svg = screen.getByRole('img', { name: DIAL_LABEL });
    expect(svg).toHaveAttribute('data-dial-figure', '');
    const wedges = container.querySelectorAll('[data-sector]');
    expect(attrs(wedges, 'data-sector')).toEqual(['0', '1', '2', '3']);
    wedges.forEach((w, k) => expect(w).toHaveAttribute('d', sectorPath(k, 4, R_FIGURE, C, C)));
    const active = container.querySelectorAll('[data-active]');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute('data-sector', '0');
    const labels = container.querySelectorAll('[data-dial-label]');
    expect([...labels].map((t) => t.textContent)).toEqual(['01', '02', '03', '04']);
  });

  it('dönüş yalnız --dial-rot ile: varsayılan −ψ₀ = −45deg; etiketler kendi merkezinde ters döner', () => {
    const { container } = render(<DialFigure n={5} ariaLabel={DIAL_LABEL} />);
    const rotor = one<SVGGElement>(container, '[data-dial-rotor]');
    expect(rotor.getAttribute('style')).toContain('transform: rotate(var(--dial-rot, -45deg))');
    expect(rotor.getAttribute('style')).toContain('transform-box: view-box');
    expect(rotor).not.toHaveAttribute('transform');
    const labels = container.querySelectorAll('[data-dial-label]');
    expect(labels).toHaveLength(5);
    labels.forEach((t) => {
      expect(t.getAttribute('style')).toContain(
        'transform: rotate(calc(-1 * var(--dial-rot, -45deg)))',
      );
      expect(t.getAttribute('style')).toContain('transform-box: fill-box');
    });
  });

  it('active: varsayılan dönüş etkin dilimi saat 9’a getirir; null → vurgu yok, ψ₀', () => {
    const { container, unmount } = render(<DialFigure n={4} ariaLabel={DIAL_LABEL} active={2} />);
    expect(dialRotation(psiDeg(2, 4))).toBe('135deg');
    expect(one(container, '[data-dial-rotor]').getAttribute('style')).toContain(
      'rotate(var(--dial-rot, 135deg))',
    );
    expect(attrs(container.querySelectorAll('[data-active]'), 'data-sector')).toEqual(['2']);
    unmount();

    const none = render(<DialFigure n={4} ariaLabel={DIAL_LABEL} active={null} />).container;
    expect(none.querySelectorAll('[data-sector]')).toHaveLength(4);
    expect(none.querySelector('[data-active]')).toBeNull();
    expect(one(none, '[data-dial-rotor]').getAttribute('style')).toContain('-45deg');
  });

  it('glyph: 64 px, aria-hidden, rol ve etiket yok; etkin dilim sabit −ψ ile saat 9’da', () => {
    const { container } = render(<DialFigure variant="glyph" n={4} active={1} ariaLabel="" />);
    const svg = one<SVGSVGElement>(container, 'svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).not.toHaveAttribute('aria-label');
    expect(svg).not.toHaveAttribute('data-dial-figure');
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('text')).toBeNull();
    expect(container.querySelector('[style]')).toBeNull(); // --dial-rot okunmaz
    const wedge = one(container, '[data-sector]');
    expect(wedge).toHaveAttribute('data-sector', '1');
    expect(wedge).toHaveAttribute('data-active', '');
    expect(wedge).toHaveAttribute('d', sectorPath(1, 4, R_GLYPH, C, C));
    expect(wedge.parentElement).toHaveAttribute('transform', `rotate(45 ${C} ${C})`); // −ψ₁ = 45
    expect(container.querySelectorAll('line')).toHaveLength(4);
  });

  it('dialRotation: 3D rotY → CSS açısı (−rotY deg)', () => {
    expect(dialRotation(45)).toBe('-45deg');
    expect(dialRotation(-135)).toBe('135deg');
    expect(dialRotation(0)).toBe('0deg');
    expect(dialRotation(12.3456)).toBe('-12.35deg');
  });
});

describe('RingsFigure', () => {
  const bands = [[10, 12], null, [3, 7], NO_BAND] as const;

  it('role="img" + aria-label; rings − 1 iç halka (dış sınır disk kenarı); yıl etiketleri', () => {
    const { container } = render(
      <RingsFigure rings={13} startYear={2014} currentYear={2026} ariaLabel={RINGS_LABEL} />,
    );
    expect(screen.getByRole('img', { name: RINGS_LABEL })).toHaveAttribute('data-rings-figure', '');
    const rings = container.querySelectorAll('[data-ring]');
    expect(rings).toHaveLength(12);
    rings.forEach((c, i) =>
      expect(c).toHaveAttribute('r', String(r2(ringRadius(i, 13, R_FIGURE)))),
    );
    expect(one(container, '[data-year="start"]')).toHaveTextContent('2014');
    expect(one(container, '[data-year="current"]')).toHaveTextContent('2026');
    expect(container.querySelector('[data-band]')).toBeNull();
  });

  it('bant grupları indekslerini korur (null / NO_BAND çizilmez); yalnız etkin olan data-active taşır', () => {
    const { container } = render(
      <RingsFigure
        rings={13}
        startYear={2014}
        currentYear={2026}
        ariaLabel={RINGS_LABEL}
        bands={bands}
        active={2}
      />,
    );
    const groups = container.querySelectorAll('[data-band]');
    expect(attrs(groups, 'data-band')).toEqual(['0', '2']);
    expect(attrs(container.querySelectorAll('[data-active]'), 'data-band')).toEqual(['2']);
    // bant [3, 7]: halka 3'ün iç kenarı (= ringRadius(2)) … halka 7'nin dış kenarı (= ringRadius(7))
    const radii = attrs(one(container, '[data-band="2"]').querySelectorAll('circle'), 'r');
    expect(radii).toContain(String(r2(ringRadius(2, 13, R_FIGURE))));
    expect(radii).toContain(String(r2(ringRadius(7, 13, R_FIGURE))));
  });

  it('active null → hiçbir bant görünür değil; data-active dışarıdan açılır', () => {
    const { container } = render(
      <RingsFigure
        rings={13}
        startYear={2014}
        currentYear={2026}
        ariaLabel={RINGS_LABEL}
        bands={bands}
      />,
    );
    expect(container.querySelector('[data-active]')).toBeNull();
    const g = one(container, '[data-band="0"]');
    g.toggleAttribute('data-active', true);
    expect(container.querySelectorAll('[data-active]')).toHaveLength(1);
  });
});

describe('ArcFigure', () => {
  const JULY_2 = new Date(2026, 6, 2, 12); // 183 / 365

  it('SSR çıktısı boş kabuktur: yay ve kırpma yolu yok', () => {
    freezeDate(JULY_2);
    const html = renderToString(<ArcFigure rings={12} />);
    expect(html).toContain('data-arc-figure');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<path');
    expect(html).not.toContain('data-arc=');
  });

  it('mount sonrası bugüne kadarki yayı arcPath kamasıyla çizer, kalanı tarar', () => {
    freezeDate(JULY_2);
    const { container } = render(<ArcFigure rings={12} />);
    const f = arcFraction(JULY_2);
    expect(one(container, 'svg')).toHaveAttribute('aria-hidden', 'true');
    const formed = one(container, '[data-arc="formed"]');
    expect(formed).toHaveAttribute('r', String(R_FIGURE));
    const clipId = formed.getAttribute('clip-path')?.slice(5, -1) ?? '';
    expect(one(container, `[id="${clipId}"] path`)).toHaveAttribute('d', arcPath(f, SIZE, 0, C, C));
    const rest = one(container, '[data-arc="rest"]');
    const restId = rest.getAttribute('clip-path')?.slice(5, -1) ?? '';
    expect(one(container, `[id="${restId}"] path`)).toHaveAttribute(
      'transform',
      `rotate(${r2(f * 360)} ${C} ${C})`,
    );
    expect(one(container, 'pattern')).toHaveAttribute('patternTransform', 'rotate(45)');
  });

  it('hidrasyon: sunucu HTML’i uyumsuzluksuz devralınır, yay hidrasyondan sonra gelir', async () => {
    freezeDate(JULY_2);
    const host = document.createElement('div');
    host.innerHTML = renderToString(<ArcFigure rings={12} />);
    document.body.append(host);
    expect(host.querySelector('[data-arc]')).toBeNull();
    const onRecoverableError = vi.fn();
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(host, <ArcFigure rings={12} />, { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(host.querySelector('[data-arc="formed"]')).not.toBeNull();
    act(() => root?.unmount());
    host.remove();
  });

  it('31 Aralık: yıl tamamdır, taranacak kısım kalmaz', () => {
    freezeDate(new Date(2026, 11, 31, 12));
    const { container } = render(<ArcFigure rings={12} />);
    expect(container.querySelector('[data-arc="formed"]')).not.toBeNull();
    expect(container.querySelector('[data-arc="rest"]')).toBeNull();
  });
});

describe('SpecimenGlyph', () => {
  it('aria-hidden; alan dilimi accent ve −ψ(alan) dönüşüyle saat 9’da; bant işareti', () => {
    const { container } = render(<SpecimenGlyph rings={12} sectors={4} band={[5, 8]} area={2} />);
    const svg = one<SVGSVGElement>(container, '[data-specimen-glyph]');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).not.toHaveAttribute('role');
    const wedge = one(container, '[data-sector]');
    expect(wedge).toHaveAttribute('data-sector', '2');
    expect(wedge).toHaveAttribute('data-active', '');
    expect(wedge).toHaveAttribute('d', sectorPath(2, 4, R_GLYPH, C, C));
    expect(one(container, '[data-sector-rotor]')).toHaveAttribute(
      'transform',
      `rotate(${-psiDeg(2, 4)} ${C} ${C})`,
    );
    const band = one(container, '[data-band]');
    expect(attrs(band.querySelectorAll('circle'), 'r')).toContain(
      String(r2(ringRadius(8, 12, R_GLYPH))),
    );
  });

  it('band null → bant yok; sectors 0 → dilim yok; area null → dönüş yok', () => {
    const noBand = render(<SpecimenGlyph rings={12} sectors={0} band={null} area={1} />).container;
    expect(noBand.querySelector('[data-band]')).toBeNull();
    expect(noBand.querySelector('[data-sector]')).toBeNull();
    expect(noBand.querySelector('[data-sector-rotor]')).toBeNull();
    cleanup();

    const noArea = render(
      <SpecimenGlyph rings={12} sectors={4} band={NO_BAND} area={null} />,
    ).container;
    expect(noArea.querySelector('[data-band]')).toBeNull();
    expect(noArea.querySelector('[data-sector]')).toBeNull();
    expect(one(noArea, '[data-sector-rotor]')).not.toHaveAttribute('transform');
    expect(noArea.querySelectorAll('[data-sector-rotor] line')).toHaveLength(4);
  });
});

describe('EntryGlyph', () => {
  it('24 px, aria-hidden; bant var / yok', () => {
    const { container } = render(<EntryGlyph rings={12} band={[4, 6]} />);
    const svg = one<SVGSVGElement>(container, '[data-entry-glyph]');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(container.querySelector('[data-band]')).not.toBeNull();
    cleanup();
    expect(
      render(<EntryGlyph rings={12} band={null} />).container.querySelector('[data-band]'),
    ).toBeNull();
  });

  it('24 halka 24 px’te seyreltilir; bant gerçek halka sayısıyla orantılı kalır', () => {
    const { container } = render(<EntryGlyph rings={24} band={[20, 23]} />);
    const drawn = container.querySelectorAll('[data-ring]');
    expect(drawn.length).toBeLessThanOrEqual(3); // + disk kenarı = en çok 4 sınır
    expect(attrs(drawn, 'data-ring')).toEqual(visibleRings(24, 24, R_GLYPH).map(String));
    const radii = attrs(one(container, '[data-band]').querySelectorAll('circle'), 'r');
    expect(radii).toContain(String(r2(ringRadius(19, 24, R_GLYPH)))); // halka 20'nin iç kenarı
    expect(radii).toContain(String(r2(ringRadius(23, 24, R_GLYPH)))); // = R_GLYPH
  });
});

describe('figure-style yardımcıları', () => {
  it('bandGeometry: sıralar, kırpar; a = 0 iç sınırsız; null ve NO_BAND → null', () => {
    expect(bandGeometry([3, 1], 4, 80)).toEqual({ inner: 20, outer: 80, mid: 50, width: 60 });
    expect(bandGeometry([0, 0], 4, 80)).toEqual({ inner: 0, outer: 20, mid: 10, width: 20 });
    expect(bandGeometry([2, 9], 4, 80)).toEqual({ inner: 40, outer: 80, mid: 60, width: 40 });
    expect(bandGeometry(null, 4, 80)).toBeNull();
    expect(bandGeometry(NO_BAND, 4, 80)).toBeNull();
  });

  it('visibleRings: sığarsa hepsi, sığmazsa eşit aralıklı gerçek sınırlar', () => {
    expect(visibleRings(4, 64, R_GLYPH)).toEqual([0, 1, 2]);
    expect(visibleRings(12, 24, R_GLYPH)).toEqual([2, 5, 8]);
    const thin = visibleRings(24, 64, R_GLYPH);
    expect(thin.length).toBeLessThanOrEqual(10);
    expect(thin.every((i, k) => i >= 0 && i <= 22 && (k === 0 || i > (thin[k - 1] ?? -1)))).toBe(
      true,
    );
  });
});
