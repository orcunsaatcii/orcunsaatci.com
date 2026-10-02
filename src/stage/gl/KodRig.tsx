// src/stage/gl/KodRig.tsx — KOD canlı paneli (§4 KOD): örneklenmiş glif dörtgenleri + yuvarlak zemin plakası. Panel
// ölçülmüş DOM çapasının içine (statik panelle aynı dikdörtgen) yerleşir; bölüm köprüsünde iki çapa arasında kayar ve
// içerik kaydırmayla yağar/çözülür, adım olayında zamanlı çözülür. Program çapadaki statik panelin data-kod'undan okunur,
// olaylarla (areas:step, journey:active, cv:active, about:cut, filtre) güncellenir. Kendiliğinden hareket (süzülme, imleç,
// akan log, yazma) duraklatmada ve son girdiden 20 s / 8 s sonra durur (K-HERO-9/10); hot reload oturumda bir kez
// (K-HERO-8). Kare başına bellek ayırma yok (§5.7.6).
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  CustomBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
  type CanvasTexture,
  type Group,
} from 'three';
import { palettes, type ThemeName } from '@/design/tokens';
import { PROFILES, type Persona } from '@/experience/profile';
import { STORAGE_KEYS } from '@/lib/head-script';
import { aboutBlocks, programKey, renderProgram } from '@/lib/kod/programs';
import { Screen } from '@/lib/kod/screen';
import type { KodData, KodProgram } from '@/lib/kod/types';
import type { MeasuredAnchor } from '../anchors';
import { anchorTop } from '../anchor-screen';
import { lastStageEvent } from '../events';
import { ATLAS } from '../kod-atlas';
import { KOD_INSTANCES, KodComposer } from '../kod-compose';
import { TIERS } from '../quality';
import { ANCHOR_VIRTUAL, live, stageStore, stageTarget, type PresetName } from '../store';

const DEG = Math.PI / 180;
/** Panel oranı: 56 sütun × 24 satır, hücre 1 : 2 → 56 : 48 */
const ASPECT = 56 / 48;
/** Kamera: z = 10, fov 30 (Scene) → görüntü alanı yüksekliği dünya biriminde */
const CAM_Z = 10;
const VIEW_H = 2 * CAM_Z * Math.tan(15 * DEG);
/** Zaman tabanlı içerikte (imleç, log, HEAD, süzülme) boşta kare aralığı */
const IDLE_MS = 90;
/** Kendiliğinden hareket son girdiden bu kadar sonra durur (K-HERO-9): ince işaretçi 20 s, kaba 8 s */
const IDLE_FINE_MS = 20_000;
const IDLE_COARSE_MS = 8_000;
/** İşaretçi paralaksı (§4.14 #1): üstel sönüm oranı (≈ smoothTime 0.32 s; çıkışta ≈ 1 s'de söner) */
const PAR_LAMBDA = 2 / 0.32;

const PREMUL = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: CustomBlending,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
} as const;

const GLYPH_VS = /* glsl */ `
  attribute vec4 aPos; attribute float aGlyph; attribute vec4 aFg; attribute vec4 aBg;
  uniform vec2 uCell;
  varying vec2 vUv; varying float vGlyph; varying vec4 vFg; varying vec4 vBg;
  void main() {
    vUv = uv; vGlyph = aGlyph; vFg = aFg; vBg = aBg;
    if (aFg.a + aBg.a < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vec3 p = vec3(aPos.xy + position.xy * uCell * aPos.w, aPos.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const GLYPH_FS = /* glsl */ `
  uniform sampler2D uAtlas; uniform vec4 uAG; uniform vec4 uAS;
  varying vec2 vUv; varying float vGlyph; varying vec4 vFg; varying vec4 vBg;
  void main() {
    float gl = floor(vGlyph + 0.5), gx = mod(gl, uAG.x), gy = floor((gl + 0.5) / uAG.x);
    vec2 px = vec2(gx * uAG.y + uAG.w + clamp(vUv.x, 0.004, 0.996) * uAS.x,
                   gy * uAG.z + uAG.w + (1.0 - clamp(vUv.y, 0.002, 0.998)) * uAS.y);
    float a = texture2D(uAtlas, vec2(px.x / uAS.z, 1.0 - px.y / uAS.w)).a * vFg.a;
    float ba = vBg.a * (1.0 - a), al = a + ba;
    if (al < 0.003) discard;
    gl_FragColor = vec4(vFg.rgb * a + vBg.rgb * ba, al);
  }`;
const PLATE_VS = /* glsl */ `
  uniform vec2 uSize; varying vec2 vP;
  void main() { vP = position.xy * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PLATE_FS = /* glsl */ `
  uniform vec2 uSize; uniform float uR; uniform vec3 uCol; uniform float uA; uniform float uSh; varying vec2 vP;
  float rr(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    float d = rr(vP, uSize * 0.5, uR), aa = fwidth(d);
    float pl = (1.0 - smoothstep(-aa, aa, d)) * uA;
    vec2 off = vec2(0.02, -0.05) * uSize.y;
    float sh = (1.0 - smoothstep(-0.04 * uSize.y, 0.14 * uSize.y, rr(vP - off, uSize * 0.5, uR))) * uSh * (1.0 - pl);
    gl_FragColor = vec4(uCol * pl + vec3(0.02, 0.03, 0.08) * sh, pl + sh);
  }`;

interface Rect {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Çapanın içine sığan panel dikdörtgeni (statik panelin CSS'iyle aynı: contain + ortalı) */
function kodRect(a: MeasuredAnchor, y: number, out: Rect): Rect {
  const top = anchorTop(a, y);
  const w = Math.min(a.width, a.height * ASPECT);
  out.cx = a.left + a.width / 2;
  out.cy = top + a.height / 2;
  out.w = w;
  out.h = w / ASPECT;
  return out;
}

/** Çapadaki statik panelin programı (data-kod); panel yoksa null (ör. work-specimen: canlı panel gizlenir) */
const programCache = new WeakMap<MeasuredAnchor, KodProgram | null>();
function anchorProgram(a: MeasuredAnchor | undefined): KodProgram | null {
  if (!a) return null;
  const hit = programCache.get(a);
  if (hit !== undefined) return hit;
  let p: KodProgram | null = null;
  const el = document.querySelectorAll<HTMLElement>(`[data-stage-anchor="${a.id}"]`)[a.slot];
  const raw = el?.querySelector<HTMLElement>('.kod-panel[data-kod]')?.dataset.kod;
  if (raw)
    try {
      p = JSON.parse(raw) as KodProgram;
    } catch {
      p = null;
    }
  programCache.set(a, p);
  return p;
}

/** Olaylarla güncellenen program; değişmezse aynı nesne döner (kare başına ayırma yok) */
const dyn = {
  area: { kind: 'area', index: 0 } as Extract<KodProgram, { kind: 'area' }>,
  journey: { kind: 'journey', active: 0 } as Extract<KodProgram, { kind: 'journey' }>,
  about: { kind: 'about', reveal: 1 } as Extract<KodProgram, { kind: 'about' }>,
  list: { kind: 'list', filter: null } as Extract<KodProgram, { kind: 'list' }>,
  /** programı belirleyen son olay instant mıydı (kesme, uzak atlama): değişim çözülmeden yazılır (§5.20.5) */
  instant: false,
};
function liveProgram(p: KodProgram | null, preset: PresetName, kod: KodData): KodProgram | null {
  dyn.instant = false;
  if (!p) return null;
  switch (p.kind) {
    case 'area': {
      if (preset !== 'home') return p;
      const e = lastStageEvent('areas:step');
      dyn.area.index = e ? e.index : p.index;
      dyn.instant = e?.instant ?? false;
      return dyn.area;
    }
    case 'journey': {
      const e = lastStageEvent(preset === 'cv-core' ? 'cv:active' : 'journey:active');
      dyn.journey.active = e ? e.index : p.active;
      dyn.instant = e?.instant ?? false;
      return dyn.journey;
    }
    case 'about': {
      if (preset !== 'home') return p;
      const e = lastStageEvent('about:cut');
      const n = aboutBlocks(kod).length;
      dyn.about.reveal = e ? Math.max(1, Math.ceil(e.cutProgress * n - 1e-6)) / n : p.reveal;
      return dyn.about;
    }
    case 'list': {
      const k = live.planFilter;
      dyn.list.filter = k === null ? null : (kod.areas[k]?.id ?? null);
      return dyn.list;
    }
    default:
      return p;
  }
}

/** Zamanla değişen içerik (imleç yanıp söner, log akar, HEAD nabzı): boşta yavaş kare */
const timed = (p: KodProgram | null) => p !== null;

/**
 * Hot reload (§4.6.5, K-HERO-8): ilk karede hero programı boştan bir kez çözülür; oturumda bir kez, yalnız sayfanın
 * tepesinde ve duraklatılmamışken. Depolama yoksa (gizli pencere) sayfa ömründe bir kez.
 */
function hotReloadAllowed(p: KodProgram | null, paused: boolean): boolean {
  if (!p || p.kind !== 'hero' || paused || window.scrollY >= 0.2 * window.innerHeight) return false;
  try {
    if (sessionStorage.getItem(STORAGE_KEYS.sweep) === '1') return false;
    sessionStorage.setItem(STORAGE_KEYS.sweep, '1');
  } catch {
    // depolama engelli: oynar
  }
  return true;
}

/** Gece paneli (journey, §5.20.4): her temada koyu değerler */
const isNight = (p: KodProgram | null) => p?.kind === 'journey';

function themePalette(persona: Persona, theme: ThemeName): number[][] {
  const c = palettes[PROFILES[persona].palette][theme];
  const rgb = (h: string) => {
    const n = Number.parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const muted = rgb(c.inkMuted),
    accent = rgb(c.accent);
  return [
    rgb(c.ink),
    muted,
    rgb(c.inkSubtle),
    accent,
    rgb(c.brass),
    rgb(c.line),
    rgb(c.surface),
    muted.map((v, k) => (v + (accent[k] ?? 0)) / 2),
  ];
}

/** GPU kaynakları bir kez kurulur; kare başına yalnız öznitelikler ve uniform değerleri yazılır */
function createGpu(atlas: CanvasTexture) {
  const composer = new KodComposer();
  const quad = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.setIndex(quad.index);
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.instanceCount = KOD_INSTANCES;
  const attr = (arr: Float32Array, n: number) =>
    new InstancedBufferAttribute(arr, n).setUsage(DynamicDrawUsage);
  const aPos = attr(composer.out.pos, 4),
    aGlyph = attr(composer.out.glyph, 1),
    aFg = attr(composer.out.fg, 4),
    aBg = attr(composer.out.bg, 4);
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aGlyph', aGlyph);
  geo.setAttribute('aFg', aFg);
  geo.setAttribute('aBg', aBg);
  const glyphMat = new ShaderMaterial({
    ...PREMUL,
    uniforms: {
      uAtlas: { value: atlas },
      uCell: { value: new Vector2(1 / 56, 1 / 24) },
      uAG: { value: new Vector4(ATLAS.cols, ATLAS.sw, ATLAS.sh, ATLAS.pad) },
      uAS: { value: new Vector4(ATLAS.cw, ATLAS.ch, ATLAS.W, ATLAS.H) },
    },
    vertexShader: GLYPH_VS,
    fragmentShader: GLYPH_FS,
  });
  const plateMat = new ShaderMaterial({
    ...PREMUL,
    uniforms: {
      uSize: { value: new Vector2(1, 1) },
      uR: { value: 0.05 },
      uCol: { value: new Color() },
      uA: { value: 0 },
      uSh: { value: 0.18 },
    },
    vertexShader: PLATE_VS,
    fragmentShader: PLATE_FS,
  });
  const plateGeo = new PlaneGeometry(1.4, 1.4);
  return {
    composer,
    geo,
    quad,
    aPos,
    aGlyph,
    aFg,
    aBg,
    glyphMat,
    plateMat,
    plateGeo,
    SA: new Screen(),
    SB: new Screen(),
    ra: { cx: 0, cy: 0, w: 0, h: 0 } as Rect,
    rb: { cx: 0, cy: 0, w: 0, h: 0 } as Rect,
    r: { cx: 0, cy: 0, w: 0, h: 0 } as Rect,
    idle: { timer: 0 },
    /** gündüz/gece rol paletleri (tema değişiminde yazılır) ve son karışım ağırlığı */
    pal: { day: [] as number[][], night: [] as number[][], dayShadow: 0.16, nw: -1 },
    /** süzülme saati (yalnız hareket açıkken ilerler: donunca yerinde kalır), sönümlü paralaks, hot reload isteği */
    motion: {
      t: 0,
      px: 0,
      py: 0,
      fine: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
      forceHot: false,
      /** son anlatı karesindeki programın yaşı: köprüde giden program buradan sürer (içerik zıplamaz) */
      age: 0,
    },
  };
}
type Gpu = ReturnType<typeof createGpu>;

/** Tema: rol renkleri ve plaka (§5.6.6: <html data-theme> değişince) */
/** Tema: gündüz (etkin tema) ve gece (koyu) rol paletleri (§5.6.6: <html data-theme> değişince); kare başına karışır */
function applyKodTheme(gpu: Gpu, persona: Persona): void {
  const theme: ThemeName = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  gpu.pal.day = themePalette(persona, theme);
  gpu.pal.night = themePalette(persona, 'dark');
  gpu.pal.dayShadow = theme === 'dark' ? 0.4 : 0.16;
  gpu.pal.nw = -1; // sonraki karede yeniden yazılır
}

/** Gece ağırlığı nw (0 gündüz … 1 gece) ile rol paleti ve plaka rengi; değişmezse yazılmaz */
function mixPalette(gpu: Gpu, nw: number): void {
  const { pal } = gpu;
  if (Math.abs(pal.nw - nw) < 1e-4) return;
  pal.nw = nw;
  for (let k = 0; k < 8; k++) {
    const dst = gpu.composer.palette[k],
      a = pal.day[k],
      b = pal.night[k];
    if (!dst || !a || !b) continue;
    for (let c = 0; c < 3; c++) dst[c] = (a[c] ?? 0) + ((b[c] ?? 0) - (a[c] ?? 0)) * nw;
  }
  const s = gpu.composer.palette[6] ?? [1, 1, 1];
  gpu.plateMat.uniforms.uCol!.value.setRGB(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1);
  gpu.plateMat.uniforms.uSh!.value = pal.dayShadow + (0.4 - pal.dayShadow) * nw;
}

function disposeGpu(gpu: Gpu): void {
  gpu.geo.dispose();
  gpu.quad.dispose();
  gpu.plateGeo.dispose();
  gpu.glyphMat.dispose();
  gpu.plateMat.dispose();
  window.clearTimeout(gpu.idle.timer);
}

/** Bir kare: program seçimi, besteleme, yerleşim ve kare isteği (§4 KOD). Kare başına ayırma yok. */
function kodFrame(gpu: Gpu, g: Group, state: RootState, delta: number): void {
  const st = stageStore.getState();
  const kod = st.data?.kod;
  const { composer, SA, SB, ra, rb, r, motion } = gpu;
  const t = state.clock.elapsedTime;
  // kendiliğinden hareket: kademe (low kapalı, step-down kapatabilir), duraklatma ve boşta kalma (K-HERO-9/10)
  const tierSpec = TIERS[st.tier === 'static' ? 'low' : st.tier];
  const motionOn = st.quality ? st.quality.motion : tierSpec.motion;
  const idleFor = performance.now() - live.lastInput;
  const frozen = st.paused || idleFor > (motion.fine ? IDLE_FINE_MS : IDLE_COARSE_MS);
  live.kod.frozen = frozen;
  if (live.kod.replayHot) {
    live.kod.replayHot = false;
    composer.reset();
    motion.forceHot = true;
  }
  const W = state.size.width,
    H = state.size.height;
  const y = window.scrollY;
  const anchors = live.anchors;
  live.frames++;
  // kesme / ilk kare (§5.9.7): yönetmen bu karenin çizilmesini bekleyip belirmeyi başlatır; program değişimi çözülmez
  const snapFrame = live.snapNextFrame;
  live.snapNextFrame = false;
  if (!kod) {
    composer.hideAll();
    gpu.plateMat.uniforms.uA!.value = 0;
    flush(gpu);
    return;
  }
  const from = stageTarget.anchorFrom,
    to = stageTarget.anchorTo,
    mix = stageTarget.anchorMix;
  const aFrom = from >= 0 ? anchors[from] : undefined,
    aTo = to >= 0 ? anchors[to] : undefined;
  const bridging = from !== to && mix > 0.001 && mix < 0.999;
  let plateA = 0;
  let active: KodProgram | null = null;
  live.kod.mix = bridging ? mix : mix >= 0.5 ? 1 : 0;
  if (bridging) {
    const pA = from === ANCHOR_VIRTUAL ? null : liveProgram(anchorProgram(aFrom), st.preset, kod);
    const keyA = pA ? programKey(pA) : '-';
    const pB = liveProgram(anchorProgram(aTo), st.preset, kod);
    const key = `${keyA}>${pB ? programKey(pB) : '-'}`;
    composer.keyChange(`b:${key}`, t);
    live.kod.key = key;
    if (pA) renderProgram(SA, kod, pA, motion.age, frozen);
    else SA.clear();
    if (pB) renderProgram(SB, kod, pB, 0, frozen);
    else SB.clear();
    // gece köprüsü: palet köprüyle aynı ilerlemeyle karışır; programsız uç (work) karışımı belirlemez
    const nA = pA ? (isNight(pA) ? 1 : 0) : isNight(pB) ? 1 : 0,
      nB = pB ? (isNight(pB) ? 1 : 0) : nA;
    mixPalette(gpu, nA + (nB - nA) * mix * mix * (3 - 2 * mix));
    composer.bridge(SA, SB, mix, t, false);
    const rA = rectOf(from, aFrom, y, ra),
      rB = rectOf(to, aTo, y, rb);
    const k = mix * mix * (3 - 2 * mix);
    const p0 = pA && rA ? rA : rB,
      p1 = pB && rB ? rB : rA;
    if (p0 && p1) {
      r.cx = p0.cx + (p1.cx - p0.cx) * k;
      r.cy = p0.cy + (p1.cy - p0.cy) * k;
      r.w = p0.w + (p1.w - p0.w) * k;
      r.h = p0.h + (p1.h - p0.h) * k;
    }
    plateA = pA && pB ? 1 : pA ? 1 - Math.min(1, mix * 1.6) : pB ? Math.min(1, mix * 1.6) : 0;
    active = pB ?? pA;
  } else {
    const idx = mix >= 0.5 ? to : from,
      a = mix >= 0.5 ? aTo : aFrom;
    const p = idx === ANCHOR_VIRTUAL ? null : liveProgram(anchorProgram(a), st.preset, kod);
    const key = p ? programKey(p) : 'none';
    if (key !== composer.key) {
      // kesme (sahne sönükken), uzak atlama ve ilk kare çözülmeden yazılır; ilk karede koşullar uyarsa hot reload
      let snap = snapFrame || stageTarget.opacityCut < 0.999 || dyn.instant;
      if (composer.key === '') {
        const hot = motion.forceHot || hotReloadAllowed(p, st.paused);
        motion.forceHot = false;
        if (hot) live.kod.hot = true;
        snap = !hot;
      }
      composer.keyChange(key, t, snap);
    }
    live.kod.key = p ? key : '';
    motion.age = Math.max(0, t - composer.tChange);
    if (p) {
      renderProgram(SB, kod, p, motion.age, frozen);
      mixPalette(gpu, isNight(p) ? 1 : 0);
      composer.narrative(SB, t, false);
    } else composer.hideAll();
    if (!rectOf(idx, a, y, r)) r.w = 0;
    plateA = p ? 1 : 0;
    active = p;
  }

  // yerleşim: ekran dikdörtgeni → dünya (kamera z = 10, fov 30)
  const dt = Math.min(0.1, Math.max(0, delta));
  if (motionOn && !frozen) motion.t += dt; // süzülme saati: donunca durur, zıplamaz
  const tx = motionOn && motion.fine && live.pointer.active ? live.pointer.x : 0,
    ty = motionOn && motion.fine && live.pointer.active ? live.pointer.y : 0;
  const kp = 1 - Math.exp(-PAR_LAMBDA * dt);
  motion.px += (tx - motion.px) * kp;
  motion.py += (ty - motion.py) * kp;
  const parMoving = Math.abs(tx - motion.px) + Math.abs(ty - motion.py) > 1e-3;
  live.kod.drift = motion.t;
  live.kod.parX = motion.px;
  live.kod.parY = motion.py;
  const fl = motionOn ? 1 : 0;
  const u = VIEW_H / Math.max(1, H);
  const pw = Math.max(1e-4, r.w * u),
    ph = Math.max(1e-4, r.h * u);
  g.position.set(
    (r.cx - W / 2) * u,
    -(r.cy - H / 2) * u + fl * Math.sin(motion.t * 0.55) * 0.012 * ph,
    0,
  );
  g.scale.set(pw, ph, ph);
  g.rotation.set(
    (-2 + motion.py * 2.5) * DEG,
    (-6 + motion.px * 4) * DEG,
    fl * Math.sin(motion.t * 0.37) * 0.2 * DEG,
  );
  gpu.plateMat.uniforms.uSize!.value.set(pw, ph);
  gpu.plateMat.uniforms.uR!.value = pw / 56;
  gpu.plateMat.uniforms.uA!.value = 0.94 * plateA;
  live.panel.x = r.cx - r.w / 2;
  live.panel.y = r.cy - r.h / 2;
  live.panel.w = r.w;
  live.panel.h = r.h;
  live.panel.visible = plateA > 0.01 && r.w > 0;
  flush(gpu);

  // kare isteği: köprü, çözülme ve paralaks sönümü sürerken her kare; zamanlı içerikte boşta yavaş; donukken yok
  window.clearTimeout(gpu.idle.timer);
  const settling = t - composer.tChange < KodComposer.SETTLE + 0.3;
  if (bridging || settling || parMoving) state.invalidate();
  else if (!frozen && timed(active))
    gpu.idle.timer = window.setTimeout(() => state.invalidate(), IDLE_MS);
}

/** Sanal çapa (route glide anlık görüntüsü) ya da ölçülmüş çapa → panel dikdörtgeni */
function rectOf(idx: number, a: MeasuredAnchor | undefined, y: number, out: Rect): Rect | null {
  if (idx === ANCHOR_VIRTUAL) {
    const v = live.virtualAnchor;
    out.cx = v.cx;
    out.cy = v.cy;
    out.w = v.D;
    out.h = v.D / ASPECT;
    return v.D > 0 ? out : null;
  }
  return a ? kodRect(a, y, out) : null;
}

export function KodRig({ atlas, persona }: { atlas: CanvasTexture; persona: Persona }) {
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Group>(null);
  const gpu = useMemo(() => createGpu(atlas), [atlas]);
  useEffect(() => () => disposeGpu(gpu), [gpu]);
  useEffect(() => {
    const apply = () => {
      applyKodTheme(gpu, persona);
      invalidate();
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [gpu, persona, invalidate]);
  // duraklatma değişince bir kare: donmuş hâl (imleç açık) çizilir ya da hareket yeniden başlar
  useEffect(
    () =>
      stageStore.subscribe((s, prev) => {
        if (s.paused !== prev.paused) invalidate();
      }),
    [invalidate],
  );
  useFrame((state, delta) => {
    if (group.current) kodFrame(gpu, group.current, state, delta);
  });
  return (
    <group ref={group}>
      <mesh geometry={gpu.plateGeo} material={gpu.plateMat} renderOrder={0} frustumCulled={false} />
      <mesh geometry={gpu.geo} material={gpu.glyphMat} renderOrder={1} frustumCulled={false} />
    </group>
  );
}

function flush(gpu: {
  aPos: InstancedBufferAttribute;
  aGlyph: InstancedBufferAttribute;
  aFg: InstancedBufferAttribute;
  aBg: InstancedBufferAttribute;
}): void {
  gpu.aPos.needsUpdate = true;
  gpu.aGlyph.needsUpdate = true;
  gpu.aFg.needsUpdate = true;
  gpu.aBg.needsUpdate = true;
}
