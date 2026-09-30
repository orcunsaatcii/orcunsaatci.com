// src/i18n/get-dictionary.ts
import 'server-only';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries/tr';
import tr from './dictionaries/tr';
import en from './dictionaries/en';

const dictionaries: Record<Locale, Dictionary> = { tr, en };

/** Senkron; iki sözlük de küçük ve yalnız sunucuda yüklenir. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
