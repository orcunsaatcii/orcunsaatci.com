// src/i18n/format.ts
import { localeMeta, type Locale } from './config';

const intl = (l: Locale) => localeMeta[l].intl; // 'tr-TR' | 'en-GB'

/** "2024" → "2024"; "2024-03" → "Mart 2024" / "March 2024"; "2024-03-15" → "15 Mart 2024" / "15 March 2024". UTC'de biçimlenir (gün kayması olmaz). */
export function formatPartialDate(value: string, locale: Locale): string {
  const [y, m, d] = value.split('-').map(Number);
  if (y === undefined || Number.isNaN(y)) throw new Error(`formatPartialDate: invalid "${value}"`);
  if (m === undefined) return String(y);
  const date = new Date(Date.UTC(y, m - 1, d ?? 1));
  return new Intl.DateTimeFormat(intl(locale), {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    ...(d === undefined ? {} : { day: 'numeric' }),
  }).format(date);
}

/** "Mart 2021 – Halen" */
export function formatRange(
  start: string,
  end: string | undefined,
  locale: Locale,
  presentLabel: string,
): string {
  return `${formatPartialDate(start, locale)} – ${end ? formatPartialDate(end, locale) : presentLabel}`;
}

export const formatNumber = (n: number, locale: Locale) =>
  new Intl.NumberFormat(intl(locale)).format(n);

export const formatPercent = (ratio: number, locale: Locale, signed = false) =>
  new Intl.NumberFormat(intl(locale), {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(ratio);

export const compareText = (locale: Locale) => new Intl.Collator(intl(locale)).compare;

export const upper = (s: string, locale: Locale) =>
  s.normalize('NFC').toLocaleUpperCase(intl(locale));
export const lower = (s: string, locale: Locale) =>
  s.normalize('NFC').toLocaleLowerCase(intl(locale));

const TR_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

/** ASCII kebab-case slug. Türkçe harfler önce açık eşlemeyle çevrilir, sonra aksanlar atılır. */
export function slugify(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase() // yalnız ASCII kaldı; kural istisnası
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
