// src/lib/kod/types.ts — KOD programlarının içerikten türeyen verisi (§4 KOD). Sunucuda üretilir, StageData ile
// istemciye JSON olarak geçer. Yalnız içerikteki olgular; kod süsü (dosya adları, Ln/Col) programlardadır.

export type KodFigure = 'phone' | 'tree' | 'api' | 'pipeline' | 'list';

export interface KodArea {
  id: string;
  title: string;
  figure: KodFigure;
  tags: string[];
  capabilities: string[];
}

export interface KodEntry {
  /** YYYY-MM */
  date: string;
  title: string;
  at: string;
  edu: boolean;
  current: boolean;
  /** DOM'daki journey girdisinin indeksi (journey:active olayı bununla gelir); eğitim −1; yoksa sıra kullanılır */
  ref?: number;
}

export interface KodProject {
  slug: string;
  title: string;
  year: string;
  role: string;
  status: string;
  areas: string[];
  facts: Array<readonly [string, string]>;
  stores: string[];
}

export interface KodData {
  locale: 'tr' | 'en';
  name: string;
  /** about.dart değişkeni: ASCII ad, küçük harf ("orcun") */
  varName: string;
  title: string;
  city: string;
  since: number | null;
  now: string | null;
  skills: string[];
  areas: KodArea[];
  journey: KodEntry[];
  email: string;
  lead: string;
  place: string;
  projects: KodProject[];
}

/** Gösterilecek program; adım ve hedef olaylardan gelir */
export type KodProgram =
  | { kind: 'hero' }
  | { kind: 'about'; reveal: number } // 0–1: görünen blok oranı
  | { kind: 'area'; index: number }
  | { kind: 'journey'; active: number }
  | { kind: 'contact' }
  | { kind: 'folio'; slug: string }
  | { kind: 'next'; slug: string }
  | { kind: 'list'; filter: string | null }
  | { kind: 'notfound'; path: string };
