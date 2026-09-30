// src/i18n/text.ts — sözlük kalıpları: {ad} enterpolasyonu, Intl.PluralRules çoğulu ve CV süresi (§3.8, §7.9.6).
// Yalnız sunucuda (statik) çağrılır; istemciye serileştirilmiş sonuç gider (§3.5.2).
import { localeMeta, type Locale } from './config';

export type PluralForms = { one: string; other: string };

/** "{count} proje" + { count: 4 } → "4 proje". Bilinmeyen anahtar olduğu gibi kalır. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Intl.PluralRules ile biçim seçer; {count} Intl.NumberFormat ile yazılır. */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const intl = localeMeta[locale].intl;
  const form = new Intl.PluralRules(intl).select(count) === 'one' ? forms.one : forms.other;
  return fill(form, { count: new Intl.NumberFormat(intl).format(count) });
}

/** Kısmi tarih → ay sayısı (yıl hassasiyetinde ay 1 kabul edilir) */
const monthIndex = (d: string) => {
  const [y, m] = d.split('-');
  return Number(y) * 12 + (m ? Number(m) - 1 : 0);
};

/**
 * "2 yıl 3 ay" / "2 years 3 months". end yoksa `today` (build tarihi, "YYYY-MM") kullanılır.
 * Ay hassasiyetinde başlangıç ve bitiş ayları dahil sayılır; yıl hassasiyetinde yalnız yıl farkı.
 */
export function duration(
  locale: Locale,
  start: string,
  end: string | undefined,
  today: string,
  forms: { years: PluralForms; months: PluralForms },
): string {
  const to = end ?? today;
  const yearOnly = !start.includes('-') && !to.includes('-');
  const total = yearOnly
    ? Math.max(0, Number(to.slice(0, 4)) - Number(start.slice(0, 4))) * 12
    : monthIndex(to) - monthIndex(start) + 1;
  const years = Math.floor(total / 12);
  const months = total % 12;
  const parts = [
    years > 0 ? plural(locale, years, forms.years) : '',
    months > 0 ? plural(locale, months, forms.months) : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : plural(locale, 1, forms.months);
}
