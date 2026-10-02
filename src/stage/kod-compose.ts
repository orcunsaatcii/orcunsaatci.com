// src/stage/kod-compose.ts — KOD besteci (§4 KOD): iki ekran tamponunu (giden A, gelen B) örneklenmiş glif dörtgenlerinin
// özniteliklerine yazar. Adım değişiminde zamanlı çözülme (karışık glifler yerine oturur, kısa vurgu parlaması); bölüm
// köprüsünde kaydırmayla sürülen yağmur (A sütun sütun düşer) + çözülme (B yukarıdan aşağı). Three-free; kare başına
// bellek ayırmaz (§5.7.6). Konumlar panel biriminde: x, y ∈ (−0.5, 0.5), z panel yüksekliği cinsinden.
import { chrome } from '@/lib/kod/programs';
import { KOD_COLS, KOD_ROWS, SCRAMBLE, Screen } from '@/lib/kod/screen';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Örnek öznitelikleri: 2 katman × 56 × 24 hücre */
export interface KodBuffers {
  pos: Float32Array; // x, y, z, ölçek
  glyph: Float32Array;
  fg: Float32Array; // r, g, b, a
  bg: Float32Array; // r, g, b, a
}

export const KOD_CELLS = KOD_COLS * KOD_ROWS;
export const KOD_INSTANCES = 2 * KOD_CELLS;

export function createKodBuffers(): KodBuffers {
  return {
    pos: new Float32Array(KOD_INSTANCES * 4),
    glyph: new Float32Array(KOD_INSTANCES),
    fg: new Float32Array(KOD_INSTANCES * 4),
    bg: new Float32Array(KOD_INSTANCES * 4),
  };
}

/** Panel yüksekliği 1 iken prototipin dünya birimlerinin karşılığı (PH = 2.4) */
const U = 1 / 2.4;

export class KodComposer {
  readonly out: KodBuffers;
  /** rol → rgb (0–1); tema değişince yazılır */
  readonly palette: number[][] = Array.from({ length: 8 }, () => [0, 0, 0]);
  private readonly bx = new Float32Array(KOD_INSTANCES);
  private readonly by = new Float32Array(KOD_INSTANCES);
  private readonly ring = new Int32Array(KOD_CELLS).fill(-1);
  private readonly prevG = new Uint16Array(KOD_CELLS);
  private readonly prevF = new Float32Array(KOD_CELLS * 4);
  private readonly prevB = new Float32Array(KOD_CELLS * 4);
  private readonly prevFx = new Uint8Array(KOD_CELLS);
  private readonly lastFx = new Uint8Array(KOD_CELLS);
  private lastKey = '';
  /** son anahtar değişiminin zamanı (s); programın yaşı bundan ölçülür */
  tChange = 0;
  private delayMul = 1;
  /**
   * Hot reload (ilk, snap'siz değişim; §4.6.5, §5.20.5): anlık görüntü gelen programın kendisidir (statik panelle aynı
   * kare) ve her dolu hücre kendi glifinden yeniden çözülür; ekran hiçbir an boşalmaz.
   */
  private replay = false;
  private capture = false;

  constructor(out: KodBuffers = createKodBuffers()) {
    this.out = out;
    for (let i = 0; i < KOD_CELLS; i++) {
      const c = i % KOD_COLS,
        r = Math.floor(i / KOD_COLS);
      const x = (c + 0.5) / KOD_COLS - 0.5,
        y = 0.5 - (r + 0.5) / KOD_ROWS;
      this.bx[i] = this.bx[KOD_CELLS + i] = x;
      this.by[i] = this.by[KOD_CELLS + i] = y;
    }
    const s = new Screen();
    chrome(s, '', '', '');
    for (let i = 0; i < KOD_CELLS; i++) {
      const c = i % KOD_COLS,
        r = Math.floor(i / KOD_COLS);
      if (r === 0 || r === KOD_ROWS - 1 || c === 0 || c === KOD_COLS - 1)
        this.ring[i] = s.g[i] ?? -1;
    }
  }

  get key(): string {
    return this.lastKey;
  }

  private write(
    o: number,
    dy: number,
    z: number,
    s: number,
    G: number,
    r: number,
    g: number,
    b: number,
    a: number,
    br: number,
    bgc: number,
    bb: number,
    ba: number,
  ): void {
    const { pos, glyph, fg, bg } = this.out;
    pos[o * 4] = this.bx[o] ?? 0;
    pos[o * 4 + 1] = (this.by[o] ?? 0) + dy;
    pos[o * 4 + 2] = z;
    pos[o * 4 + 3] = s;
    glyph[o] = G;
    fg[o * 4] = r;
    fg[o * 4 + 1] = g;
    fg[o * 4 + 2] = b;
    fg[o * 4 + 3] = a;
    bg[o * 4] = br;
    bg[o * 4 + 1] = bgc;
    bg[o * 4 + 2] = bb;
    bg[o * 4 + 3] = ba;
  }

  private hide(o: number): void {
    this.out.fg[o * 4 + 3] = 0;
    this.out.bg[o * 4 + 3] = 0;
  }

  hideAll(): void {
    for (let o = 0; o < KOD_INSTANCES; o++) this.hide(o);
  }

  /** Boş başlangıç: sonraki anahtar değişimi ilk kare sayılır (hot reload'u yeniden oynatmak için, §5.20.5) */
  reset(): void {
    this.hideAll();
    this.lastFx.fill(0);
    this.lastKey = '';
    this.replay = false;
    this.capture = false;
  }

  /**
   * Anahtar değişince görünen katmanın anlık görüntüsü alınır; yenisi bundan çözülür. snap (instant: kesme, geri
   * yükleme, ilk kare): çözülme oynamaz, son kare doğrudan yazılır (§5.20.5).
   */
  keyChange(key: string, t: number, snap = false): boolean {
    if (key === this.lastKey) return false;
    const first = this.lastKey === '';
    const { glyph, fg, bg } = this.out;
    for (let i = 0; i < KOD_CELLS; i++) {
      const vis = (o: number) => (fg[o * 4 + 3] ?? 0) + (bg[o * 4 + 3] ?? 0);
      const src = vis(i) > vis(KOD_CELLS + i) ? i : KOD_CELLS + i;
      this.prevG[i] = glyph[src] ?? 0;
      this.prevFx[i] = this.lastFx[i] ?? 0;
      for (let q = 0; q < 4; q++) {
        this.prevF[i * 4 + q] = fg[src * 4 + q] ?? 0;
        this.prevB[i * 4 + q] = bg[src * 4 + q] ?? 0;
      }
    }
    this.delayMul = first ? 1.5 : 1;
    this.tChange = snap ? t - KodComposer.SETTLE - 1 : first ? t + 0.3 : t;
    this.replay = first && !snap;
    this.capture = this.replay;
    this.lastKey = key;
    return true;
  }

  private delay(i: number): number {
    const c = i % KOD_COLS,
      r = Math.floor(i / KOD_COLS);
    return 0.04 + 0.62 * (r / KOD_ROWS) + 0.12 * (c / KOD_COLS) + 0.22 * hash(i * 1.37 + 9);
  }

  private rnd(i: number, t: number): number {
    const k = Math.floor(hash(i * 3.17 + Math.floor(t * 15 + hash(i) * 40)) * SCRAMBLE.length);
    return SCRAMBLE[k] ?? 0;
  }

  /** Zamanlı çözülme süresi (s): bu süre boyunca kare istenir */
  static readonly SETTLE = 1.5 * (0.04 + 0.62 + 0.12 + 0.22) + 0.6;

  /** Kararlı durum: B görünür, anahtar değiştiyse değişen hücreler çözülür. */
  narrative(B: Screen, t: number, reduce: boolean): void {
    for (let i = 0; i < KOD_CELLS; i++) this.hide(i);
    const el = reduce ? 99 : t - this.tChange;
    const P = this.palette,
      sc = P[7] ?? [0, 0, 0],
      ac = P[3] ?? [0, 0, 0];
    if (this.capture) {
      // hot reload: önceki kare = gelen programın son hâli (statik panelle hizalı ilk kare)
      this.capture = false;
      for (let i = 0; i < KOD_CELLS; i++) {
        const fc = P[B.fr[i] ?? 0] ?? sc,
          bc = P[B.br[i] ?? 0] ?? sc;
        this.prevG[i] = B.g[i] ?? 0;
        this.prevFx[i] = 0;
        for (let q = 0; q < 3; q++) {
          this.prevF[i * 4 + q] = fc[q] ?? 0;
          this.prevB[i * 4 + q] = bc[q] ?? 0;
        }
        this.prevF[i * 4 + 3] = B.fa[i] ?? 0;
        this.prevB[i * 4 + 3] = B.ba[i] ?? 0;
      }
    }
    for (let i = 0; i < KOD_CELLS; i++) {
      const o = KOD_CELLS + i,
        g = B.g[i] ?? 0,
        pg = this.prevG[i] ?? 0,
        fc = P[B.fr[i] ?? 0] ?? sc,
        bc = P[B.br[i] ?? 0] ?? sc;
      let G = g,
        r = fc[0] ?? 0,
        gg = fc[1] ?? 0,
        b = fc[2] ?? 0,
        A = B.fa[i] ?? 0,
        z = 0.015 * U,
        br = bc[0] ?? 0,
        bgc = bc[1] ?? 0,
        bb = bc[2] ?? 0,
        ba = B.ba[i] ?? 0;
      const fx = B.fx[i] ?? 0;
      const changed = this.replay ? g !== 0 : pg !== g || (fx === 1 && this.prevFx[i] !== 1);
      const pF = this.prevF,
        pB = this.prevB;
      if (changed) {
        const d = this.delay(i) * this.delayMul;
        if (el < d - 0.28) {
          G = pg;
          r = pF[i * 4] ?? 0;
          gg = pF[i * 4 + 1] ?? 0;
          b = pF[i * 4 + 2] ?? 0;
          A = pF[i * 4 + 3] ?? 0;
          br = pB[i * 4] ?? 0;
          bgc = pB[i * 4 + 1] ?? 0;
          bb = pB[i * 4 + 2] ?? 0;
          ba = pB[i * 4 + 3] ?? 0;
        } else if (el < d) {
          if (pg || g) {
            G = this.rnd(i, t);
            r = sc[0] ?? 0;
            gg = sc[1] ?? 0;
            b = sc[2] ?? 0;
            A = 0.85;
            z += 0.05 * U;
          } else A = 0;
          br = pB[i * 4] ?? 0;
          bgc = pB[i * 4 + 1] ?? 0;
          bb = pB[i * 4 + 2] ?? 0;
          ba = pB[i * 4 + 3] ?? 0;
        } else {
          const f = smooth((el - d) / 0.3);
          r = lerp(ac[0] ?? 0, r, f);
          gg = lerp(ac[1] ?? 0, gg, f);
          b = lerp(ac[2] ?? 0, b, f);
          z += 0.05 * U * (1 - f);
        }
      } else if (el < 0.35) {
        const k = smooth(el / 0.35);
        r = lerp(pF[i * 4] ?? 0, r, k);
        gg = lerp(pF[i * 4 + 1] ?? 0, gg, k);
        b = lerp(pF[i * 4 + 2] ?? 0, b, k);
        A = lerp(pF[i * 4 + 3] ?? 0, A, k);
        br = lerp(pB[i * 4] ?? 0, br, k);
        bgc = lerp(pB[i * 4 + 1] ?? 0, bgc, k);
        bb = lerp(pB[i * 4 + 2] ?? 0, bb, k);
        ba = lerp(pB[i * 4 + 3] ?? 0, ba, k);
      }
      this.write(o, 0, z, 1, G, r, gg, b, A, br, bgc, bb, ba);
    }
    this.lastFx.set(B.fx);
  }

  /** Köprü: A sütun sütun yağar, B yukarıdan aşağı çözülür; bt kaydırma ilerlemesi (0–1). */
  bridge(A: Screen, B: Screen, bt: number, t: number, reduce: boolean): void {
    const P = this.palette,
      sc = P[7] ?? [0, 0, 0],
      ac = P[3] ?? [0, 0, 0];
    for (let i = 0; i < KOD_CELLS; i++) {
      const oA = i,
        oB = KOD_CELLS + i,
        c = i % KOD_COLS,
        r = Math.floor(i / KOD_COLS);
      const ring = this.ring[i] ?? -1;
      if (ring >= 0 && A.g[i] === ring && B.g[i] === ring) {
        const fc = P[B.fr[i] ?? 0] ?? sc;
        this.write(
          oB,
          0,
          0.015 * U,
          1,
          ring,
          fc[0] ?? 0,
          fc[1] ?? 0,
          fc[2] ?? 0,
          B.fa[i] ?? 0,
          0,
          0,
          0,
          0,
        );
        this.hide(oA);
        continue;
      }
      // A · giden: sütun sütun düşer, düşerken karışır
      const ga = A.g[i] ?? 0;
      const f = reduce ? (bt < 0.5 ? 0 : 1) : clamp((bt - 0.03 - 0.3 * hash(c + 91)) / 0.5);
      if ((ga || (A.ba[i] ?? 0) > 0) && f < 1) {
        const fc = P[A.fr[i] ?? 0] ?? sc,
          bc = P[A.br[i] ?? 0] ?? sc,
          m = 0.55 * smooth(f * 4);
        this.write(
          oA,
          -f * f * (1.4 + 1.2 * hash(i * 1.9)) * U,
          (0.015 + f * 0.3 * (hash(i + 3) - 0.25)) * U,
          1,
          f > 0.03 && ga ? this.rnd(i, t) : ga,
          lerp(fc[0] ?? 0, ac[0] ?? 0, m),
          lerp(fc[1] ?? 0, ac[1] ?? 0, m),
          lerp(fc[2] ?? 0, ac[2] ?? 0, m),
          (A.fa[i] ?? 0) * (1 - smooth(f * 1.2)),
          bc[0] ?? 0,
          bc[1] ?? 0,
          bc[2] ?? 0,
          (A.ba[i] ?? 0) * (1 - smooth(f * 3)),
        );
      } else this.hide(oA);
      // B · gelen: yukarıdan aşağı, karışık gliflerden çözülür
      const gb = B.g[i] ?? 0,
        th = 0.32 + 0.5 * (r / KOD_ROWS) + 0.14 * hash(i + 5),
        ap = th - 0.16;
      const on = reduce ? bt >= 0.5 : bt >= ap;
      if (!on || (!gb && (B.ba[i] ?? 0) <= 0)) {
        this.hide(oB);
        continue;
      }
      const fc = P[B.fr[i] ?? 0] ?? sc,
        bc = P[B.br[i] ?? 0] ?? sc;
      if (!reduce && bt < th)
        this.write(
          oB,
          0,
          0.07 * U,
          1,
          gb ? this.rnd(i, t) : 0,
          sc[0] ?? 0,
          sc[1] ?? 0,
          sc[2] ?? 0,
          gb ? 0.8 * smooth((bt - ap) / 0.05) : 0,
          0,
          0,
          0,
          0,
        );
      else {
        const k = reduce ? 1 : smooth((bt - th) / 0.08);
        this.write(
          oB,
          0,
          (0.015 + 0.05 * (1 - k)) * U,
          1,
          gb,
          lerp(ac[0] ?? 0, fc[0] ?? 0, k),
          lerp(ac[1] ?? 0, fc[1] ?? 0, k),
          lerp(ac[2] ?? 0, fc[2] ?? 0, k),
          B.fa[i] ?? 0,
          bc[0] ?? 0,
          bc[1] ?? 0,
          bc[2] ?? 0,
          (B.ba[i] ?? 0) * k,
        );
      }
    }
    this.lastFx.set(B.fx);
  }
}
