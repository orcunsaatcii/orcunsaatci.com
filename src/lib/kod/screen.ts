// src/lib/kod/screen.ts — KOD ekran tamponu ve glif kümesi (§4 KOD). Three-free, React-free: sunucu (statik panel)
// ve istemci (WebGL ızgarası) aynı tamponu yazar. Hücre: glif, ön plan rolü + saydamlık, zemin rolü + saydamlık, efekt.

const ASCII = Array.from({ length: 95 }, (_, k) => String.fromCharCode(32 + k)).join('');
/** Fontla çizilen glifler: ASCII, Türkçe ve birkaç işaret */
export const FONT_SET = `${ASCII}çğıİöşüÇĞÖŞÜâîûÂÎÛ·•…×↑↓’“”–—₺`;
/** Fontta olmayan ya da dikişsiz birleşmesi gerekenler: WebGL atlasında elle çizilir, HTML'de 1ch hücreye sığdırılır */
export const DRAWN = '─│├└┌┐┘┤┬┴┼╭╮╰╯━┃→←✓●○█░▸';
export const GLYPHS: readonly string[] = [...FONT_SET, ...DRAWN];
const GI = new Map(GLYPHS.map((c, k) => [c, k]));
const UNKNOWN = GI.get('?') ?? 0;
export const glyphIndex = (c: string): number => GI.get(c) ?? UNKNOWN;
export const isDrawn = (c: string): boolean => DRAWN.includes(c);
/** Bağlanmayan tek işaretler (●, ✓, ok …): HTML'de hücre ortasına yerleşir, kırpılmaz */
const SYMBOLS = '→←✓●○█░▸';
export const isSymbol = (c: string): boolean => SYMBOLS.includes(c);
/** Çözülme sırasında görünen rastgele glifler */
export const SCRAMBLE: readonly number[] = [
  ...'abcdefghijklmnopqrstuvwxyz0123456789{}[]()<>=+-*/;:_$#@&%?!',
].map(glyphIndex);
/** ASCII görsel: parlaklık → yoğunluk */
export const RAMP: readonly number[] = [...' .:-=+*#%@'].map(glyphIndex);

/** Renk rolleri; renk değerleri temadan gelir (WebGL: CSS değişkenleri, HTML: .k-* sınıfları) */
export const ROLE = {
  ink: 0,
  muted: 1,
  subtle: 2,
  accent: 3,
  brass: 4,
  line: 5,
  panel: 6,
  scramble: 7,
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];
export const ROLE_NAMES = [
  'ink',
  'muted',
  'subtle',
  'accent',
  'brass',
  'line',
  'panel',
  'scramble',
] as const;

/** Ana ızgara: 56 × 24 hücre, hücre oranı 1 : 2 (Martian Mono, yarı dar) */
export const KOD_COLS = 56;
export const KOD_ROWS = 24;

export const textLen = (s: string): number => [...s].length;

export class Screen {
  readonly cols: number;
  readonly rows: number;
  readonly g: Uint16Array; // glif indeksi (0 = boşluk)
  readonly fr: Uint8Array; // ön plan rolü
  readonly fa: Float32Array; // ön plan saydamlığı
  readonly br: Uint8Array; // zemin rolü
  readonly ba: Float32Array; // zemin saydamlığı
  readonly fx: Uint8Array; // 1 = vurgulu satır (değişince yeniden çözülür)

  constructor(cols: number = KOD_COLS, rows: number = KOD_ROWS) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.g = new Uint16Array(n);
    this.fr = new Uint8Array(n);
    this.fa = new Float32Array(n);
    this.br = new Uint8Array(n);
    this.ba = new Float32Array(n);
    this.fx = new Uint8Array(n);
  }

  clear(): void {
    this.g.fill(0);
    this.fr.fill(0);
    this.fa.fill(0);
    this.br.fill(0);
    this.ba.fill(0);
    this.fx.fill(0);
  }

  /** x, y'den başlayarak yazar; ızgara dışı kırpılır. Sonraki sütunu döner. */
  put(x: number, y: number, s: string, role: Role = ROLE.ink, a = 1, fx = 0): number {
    let cx = x;
    for (const ch of s) {
      if (y >= 0 && y < this.rows && cx >= 0 && cx < this.cols) {
        const i = y * this.cols + cx;
        this.g[i] = glyphIndex(ch);
        this.fr[i] = role;
        this.fa[i] = a;
        this.fx[i] = fx;
      }
      cx++;
    }
    return cx;
  }

  /** Dikdörtgen zemin (uçlar dahil) */
  bg(x0: number, y0: number, x1: number, y1: number, role: Role, a: number): void {
    for (let y = Math.max(0, y0); y <= Math.min(this.rows - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.cols - 1, x1); x++) {
        const i = y * this.cols + x;
        this.br[i] = role;
        this.ba[i] = a;
      }
  }
}

/** Statik panel için satır başına stil koşuları (aynı rol + saydamlık + zemin birleşir) */
export interface Run {
  text: string;
  role: Role;
  alpha: number;
  bgRole: Role;
  bgAlpha: number;
  /** kutu çizgisi koşusu (1ch hücrelere sabitlenir) */
  drawn: boolean;
  /** tek işaret (hücre ortasında) */
  symbol: boolean;
}

export function screenRuns(s: Screen): Run[][] {
  const rows: Run[][] = [];
  for (let y = 0; y < s.rows; y++) {
    const row: Run[] = [];
    let cur: Run | null = null;
    for (let x = 0; x < s.cols; x++) {
      const i = y * s.cols + x;
      const ch = GLYPHS[s.g[i] ?? 0] ?? ' ';
      const visible = (s.fa[i] ?? 0) > 0.003 && ch !== ' ';
      const role = (visible ? s.fr[i] : ROLE.ink) as Role;
      const alpha = visible ? Math.round((s.fa[i] ?? 0) * 100) / 100 : 0;
      const bgAlpha = Math.round((s.ba[i] ?? 0) * 100) / 100;
      const bgRole = (bgAlpha > 0 ? s.br[i] : ROLE.ink) as Role;
      const symbol = visible && isSymbol(ch);
      const drawn = visible && !symbol && isDrawn(ch);
      const text = visible ? ch : ' ';
      if (
        cur &&
        !symbol &&
        !cur.symbol &&
        cur.role === role &&
        cur.alpha === alpha &&
        cur.bgRole === bgRole &&
        cur.bgAlpha === bgAlpha &&
        cur.drawn === drawn
      )
        cur.text += text;
      else {
        cur = { text, role, alpha, bgRole, bgAlpha, drawn, symbol };
        row.push(cur);
      }
    }
    rows.push(row);
  }
  return rows;
}
