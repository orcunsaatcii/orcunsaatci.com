// src/stage/gl/shaders/stone.frag.ts — Taş yüzeyi ve kesit kapağı tek draw'da (§5.4.1).
// Bütün gölgelendirme object space'tedir; kapak rengi her pikselde hesaplanır ve gl_FrontFacing ile seçilir
// (fwidth yalnız tekdüze kontrol akışında tanımlıdır, not 1). discard en sonda yapılır.
import { HASH13, SNOISE3 } from './noise.glsl';

export const stoneFrag = /* glsl */ `
#define TAU 6.283185307179586
#ifndef HATCH_PERIOD
#define HATCH_PERIOD 0.035   // açık yay dışındaki 45° tarama aralığı, object birimi (M1'de ayarlanır)
#endif
#ifndef WAVE_WIDTH_PX
#define WAVE_WIDTH_PX 2.0    // kopyalama dalgası çizgisi, px: IntensityParams.waveWidthPx (§4.17.4, §5.6.7)
#endif

uniform vec4  uPlane;          // xyz = düzlem normali (object space, varsayılan (0,1,0)); w = KESİT (cut)
uniform vec3  uPlaneU;         // düzlem içi taban: (1,0,0)
uniform vec3  uPlaneV;         // (0,0,-1)
uniform vec3  uCamObj;         // kamera konumu, object space
uniform float uCapRadius;      // mevcut kesitte kesit yarıçapı (CPU, §5.10)
uniform vec2  uShape;
uniform float uSeed;

uniform vec3  uLightObj;       // anahtar ışık yönü, object space, normalize
uniform vec3  uUpObj;          // dünya yukarısı, object space, normalize
uniform float uWrap;           // 0.35
uniform float uAmbient;        // 0.18
uniform float uRimStrength;    // 0.25 (Contact'ta 0.35)
uniform float uGrain;          // 0.035
uniform float uGrainScale;     // 220

uniform vec3 uStoneBase, uStoneLight, uCapBase, uRingLine, uAccent, uRimColor, uSky, uGround, uCanvas;

uniform float uRings;          // 4..24
uniform float uRingContrast;   // 0..1
uniform float uRingWarp;       // 0.04
uniform float uSectors;        // 3..6 (0 = dilim yok)
uniform float uSectorOffset;   // radyan: radians(135 - 180/N)
uniform float uSectorMix;      // 0..1: dilim çizgileri merkezden dışa büyür
uniform float uSectorFill[6];  // 0..1
uniform vec2  uSectorPreview;  // (indeks, alfa)
uniform vec3  uBand;           // (başlangıç halkası, bitiş halkası, görünürlük)
uniform vec3  uBandPreview;    // (başlangıç, bitiş, alfa)
uniform float uBandLift;       // 0.18
uniform float uArc;            // yılın geçen oranı (yalnız client)
uniform float uArcGlow;        // 0..1
uniform float uArcPulse;       // 0..1
uniform float uWave;           // -1 = kapalı, 0 -> 1
uniform float uTone;           // 1 = tam varlık; 0 = sayfa rengine karışır
#ifdef CAP_PATTERN_GROWTH
uniform float uRingEdges[25];  // normalize kümülatif halka kenarları (section-geometry.ringEdges)
#endif

varying vec3 vObj;
varying vec3 vNrm;

${SNOISE3}
${HASH13}

// widthPx genişliğinde, 1 px yumuşak kenarlı çizgi. fw: d'nin piksel başına değişimi.
float aaLine(float d, float fw, float widthPx) {
  float h = 0.5 * widthPx;
  float w = max(fw, 1e-6);
  return 1.0 - smoothstep(h * w, (h + 1.0) * w, d);
}

float superNorm(vec2 p, float n) {
  return pow(pow(abs(p.x), n) + pow(abs(p.y), n), 1.0 / n);
}

// Halka koordinatı x: tam sayı değerleri halka sınırlarıdır. 0 = çekirdek, uRings = kenar.
float ringCoord(vec2 uv, float rho, float a) {
#if defined(CAP_PATTERN_GROWTH)
  float x = 0.0;
  for (int i = 0; i < 24; i++) {
    if (float(i) >= uRings) break;
    float e0 = uRingEdges[i];
    float e1 = uRingEdges[i + 1];
    x = float(i) + clamp((rho - e0) / max(e1 - e0, 1e-4), 0.0, 1.0);
    if (rho < e1) break;
  }
  return x;
#elif defined(CAP_PATTERN_AGATE)
  return (rho + 0.08 * snoise(vec3(uv * 2.5, uSeed))) * uRings;
#elif defined(CAP_PATTERN_CONTOURS) || defined(CAP_PATTERN_POCHE)
  return rho * uRings;
#else  // CAP_PATTERN_RINGS (varsayılan)
  float w = snoise(vec3(cos(a) * 1.5, sin(a) * 1.5, rho * 2.0 + uSeed));
  return (rho + w * uRingWarp) * uRings;
#endif
}

vec3 shadeSurface(vec3 N, vec3 V) {
  float wrap  = max(0.0, (dot(N, uLightObj) + uWrap) / (1.0 + uWrap));
  vec3  base  = mix(uStoneBase, uStoneLight, wrap);
  vec3  hemi  = mix(uGround, uSky, dot(N, uUpObj) * 0.5 + 0.5) * uAmbient;
  vec3  rim   = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uRimStrength * uRimColor;
  float grain = (hash13(floor(vObj * uGrainScale)) - 0.5) * uGrain;
  vec3 col = base * (1.0 + grain) + hemi + rim;
#ifdef SURFACE_ANODIZED
  // anodized: grafit + ince doğrusal parlaklık (§4.17.2, §5.4.3). Başlangıç değerleri; M1 poster onayında sabitlenir.
  // fwidth yok: shadeSurface gl_FrontFacing seçiminin içinde, tekdüze olmayan akışta çağrılır (not 1).
  float spec  = pow(max(dot(N, normalize(uLightObj + V)), 0.0), 40.0);
  float lines = 0.75 + 0.25 * cos(vObj.y * 360.0);   // object-space Y boyunca ince çizgiler (periyot ~0.017)
  col += uStoneLight * 0.12 * spec * lines;
#endif
  return col;
}

vec3 shadeCap(vec2 uv) {
  float rho = superNorm(uv, uShape.x) / max(uCapRadius, 1e-4);   // 0 = çekirdek, 1 = kenar
  float a   = atan(uv.y, uv.x);                                    // +X'ten -Z'ye doğru, saat yönü tersine
  vec3  col = uCapBase * (0.9 + 0.1 * max(dot(uPlane.xyz, uLightObj), 0.0));
  vec3  lineCol = uRingLine;

#ifdef CAP_PATTERN_POCHE
  col = mix(col, uRingLine, 0.85);       // mürekkep dolgu
  lineCol = uCapBase;                    // çizgiler ters renkte
#endif

  // 1) Halkalar
  float x   = ringCoord(uv, rho, a);
  float fwx = fwidth(x);
  float ringIdx = clamp(floor(x), 0.0, uRings - 1.0);             // 0 = en eski, uRings-1 = bu yıl
  col = mix(col, lineCol, aaLine(abs(x - floor(x + 0.5)), fwx, 1.0) * uRingContrast);

#ifdef CAP_PATTERN_CONTOURS
  vec2 gq = uv / 0.05;
  vec2 gd = abs(fract(gq + 0.5) - 0.5);
  float grid = max(aaLine(gd.x, fwidth(gq.x), 1.0), aaLine(gd.y, fwidth(gq.y), 1.0));
  col = mix(col, lineCol, 0.12 * grid * uRingContrast);
#endif
#ifdef CAP_PATTERN_AGATE
  col = mix(col, uAccent, 0.08 * mod(ringIdx, 2.0));
#endif

  // 2) Dilim çizgileri (merkezden uSectorMix'e kadar)
  float n   = max(uSectors, 1.0);
  float s   = fract((a - uSectorOffset) / TAU) * n;
  float secIdx = min(floor(s), n - 1.0);
  float sd  = abs(fract(s + 0.5) - 0.5) * (TAU / n) * rho;        // en yakın sınıra yay uzunluğu
  float secLine = aaLine(sd, fwidth(sd), 1.0) * (1.0 - smoothstep(uSectorMix - 0.01, uSectorMix, rho));
  col = mix(col, lineCol, secLine * step(0.5, uSectors));

  // 3) Dilim dolgusu ve önizleme
  float f = uSectorFill[int(secIdx)];
  col = mix(col, uAccent, 0.5 * (1.0 - smoothstep(f - 0.02, f, rho)) * step(0.001, f) * step(0.5, uSectors));
  float isPrev = 1.0 - step(0.5, abs(secIdx - uSectorPreview.x));
  col = mix(col, uAccent, 0.25 * uSectorPreview.y * isPrev * step(0.5, uSectors));

  // 4) Aktif bant (+1.5 px kenarlar) ve bant önizlemesi
  float inBand = step(uBand.x - 0.5, ringIdx) * step(ringIdx, uBand.y + 0.5);
  col = mix(col, uAccent, uBandLift * uBand.z * inBand);
  float edge = max(aaLine(abs(x - uBand.x), fwx, 1.5), aaLine(abs(x - (uBand.y + 1.0)), fwx, 1.5));
  col = mix(col, uAccent, edge * uBand.z);
  float inPrev = step(uBandPreview.x - 0.5, ringIdx) * step(ringIdx, uBandPreview.y + 0.5);
  col = mix(col, uAccent, 0.10 * uBandPreview.z * inPrev);

  // 5) Açık dış halka: bugüne kadar yakut, sonrası düşük kontrastlı 45° tarama ("henüz oluşmadı")
  float outer = step(uRings - 1.5, ringIdx);
  float f12   = fract(0.25 - a / TAU);                           // saat 12'den saat yönünde
  float lit   = 1.0 - step(uArc, f12);                           // f12 < uArc
  float hs    = (uv.x + uv.y) / HATCH_PERIOD;
  float hatch = aaLine(abs(fract(hs + 0.5) - 0.5), fwidth(hs), 1.0);
  float tip   = 1.0 - smoothstep(0.0, 0.01, abs(f12 - uArc));
  col = mix(col, lineCol, outer * (1.0 - lit) * 0.25 * hatch * uRingContrast);
  col = mix(col, uAccent, outer * clamp(lit * 0.6 * uArcGlow + tip * uArcPulse, 0.0, 1.0));

  // 6) Kopyalama dalgası (WAVE_WIDTH_PX; standard 2 px)
  float waveOn = step(0.0, uWave);
  col = mix(col, uAccent, waveOn * aaLine(abs(rho - uWave), fwidth(rho), WAVE_WIDTH_PX));

  return col;
}

void main() {
  // Kapak: ışın–düzlem kesişimi (her pikselde hesaplanır; türevler tekdüze akışta kalır)
  vec3  rd  = normalize(vObj - uCamObj);
  float den = dot(rd, uPlane.xyz);
  den = den >= 0.0 ? max(den, 1e-4) : min(den, -1e-4);          // sıyırma açısı koruması: 0'a bölme yok
  float t   = (uPlane.w - dot(uCamObj, uPlane.xyz)) / den;
  vec3  q   = uCamObj + rd * t;
  vec3  capCol = shadeCap(vec2(dot(q, uPlaneU), dot(q, uPlaneV)));

  vec3 col = gl_FrontFacing
    ? shadeSurface(normalize(vNrm), normalize(uCamObj - vObj))
    : capCol;
  col = mix(uCanvas, col, uTone);                                // varlık: sayfa rengine geri çekil

  if (dot(vObj, uPlane.xyz) - uPlane.w > 0.0) discard;           // kaldırılmış yarı
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
