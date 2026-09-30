// src/stage/anchors.test.ts — ANCHORS kaydı §5.7.3 tablosuyla tutarlı.
import { describe, expect, it } from 'vitest';
import { ANCHORS, PAGE_FOLIO_SIZE } from './anchors';

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
