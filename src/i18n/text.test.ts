// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { duration, fill, plural } from './text';

const tr = {
  years: { one: '{count} yıl', other: '{count} yıl' },
  months: { one: '{count} ay', other: '{count} ay' },
};
const en = {
  years: { one: '{count} year', other: '{count} years' },
  months: { one: '{count} month', other: '{count} months' },
};

describe('i18n/text', () => {
  it('fill: {ad} enterpolasyonu; bilinmeyen anahtar kalır', () => {
    expect(fill('© {year} {name}', { year: 2026, name: 'Ad' })).toBe('© 2026 Ad');
    expect(fill('{x} ve {y}', { x: 1 })).toBe('1 ve {y}');
  });

  it('plural: Intl.PluralRules ve sayı biçimi', () => {
    expect(plural('tr', 1, { one: '{count} proje', other: '{count} proje' })).toBe('1 proje');
    expect(plural('en', 1, { one: '{count} project', other: '{count} projects' })).toBe(
      '1 project',
    );
    expect(plural('en', 4, { one: '{count} project', other: '{count} projects' })).toBe(
      '4 projects',
    );
    expect(plural('tr', 1250, { one: '{count} gün', other: '{count} gün' })).toBe('1.250 gün');
  });

  it('duration: ay hassasiyeti uçlar dahil; yıl hassasiyeti yıl farkı; sürüyorsa bugün', () => {
    expect(duration('tr', '2020-03', '2022-12', '2026-09', tr)).toBe('2 yıl 10 ay');
    expect(duration('en', '2020-01', '2020-12', '2026-09', en)).toBe('1 year');
    expect(duration('en', '2024-05', '2024-05', '2026-09', en)).toBe('1 month');
    expect(duration('tr', '2010', '2014', '2026-09', tr)).toBe('4 yıl');
    expect(duration('tr', '2026-01', undefined, '2026-09', tr)).toBe('9 ay');
  });
});
