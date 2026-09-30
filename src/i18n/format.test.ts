// src/i18n/format.test.ts — §3.8 tablosu
import { describe, expect, it } from 'vitest';
import {
  compareText,
  formatNumber,
  formatPartialDate,
  formatPercent,
  formatRange,
  lower,
  slugify,
  upper,
} from './format';

describe('§3.8 Türkçe kuralları', () => {
  it('slugify', () => {
    expect(slugify('Işık & Gölge Çalışması')).toBe('isik-golge-calismasi');
    expect(slugify('  Ürün / Ödeme  ')).toBe('urun-odeme');
  });

  it('upper / lower dil parametresiyle', () => {
    expect(upper('istanbul', 'tr')).toBe('İSTANBUL');
    expect(upper('Orçun Saatçi', 'tr')).toBe('ORÇUN SAATÇİ');
    expect(lower('İSTANBUL', 'tr')).toBe('istanbul');
    expect(lower('İSTANBUL', 'tr')).not.toContain('̇');
    expect(upper('istanbul', 'en')).toBe('ISTANBUL');
  });

  it('tarih biçimleri', () => {
    expect(formatPartialDate('2024-03', 'tr')).toBe('Mart 2024');
    expect(formatPartialDate('2024-03', 'en')).toBe('March 2024');
    expect(formatPartialDate('2024', 'tr')).toBe('2024');
    expect(formatPartialDate('2024-03-15', 'en')).toBe('15 March 2024');
    expect(formatRange('2021-03', undefined, 'tr', 'Halen')).toBe('Mart 2021 – Halen');
    expect(() => formatPartialDate('x', 'tr')).toThrow();
  });

  it('sayı ve yüzde', () => {
    expect(formatNumber(1250, 'tr')).toBe('1.250');
    expect(formatPercent(0.38, 'tr', true)).toBe('+%38');
    expect(formatPercent(0.38, 'en', true)).toBe('+38%');
  });

  it('Türkçe sıralama', () => {
    expect(['şu', 'su', 'çay', 'cam', 'ılık', 'iz'].sort(compareText('tr'))).toEqual([
      'cam',
      'çay',
      'ılık',
      'iz',
      'su',
      'şu',
    ]);
  });
});
