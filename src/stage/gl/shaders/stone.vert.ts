// src/stage/gl/shaders/stone.vert.ts — süperkuadrik Taş; şekil tamamen vertex shader'da kurulur (§5.3.3).
// GLSL1 tarzı yazılır ve glslVersion ayarlanmaz: three r186 ShaderMaterial için #version 300 es önekini ekler.
// fbm, noise.glsl.ts'teki FBM3'tür: stone.frag akik bantlarında kabuk hattını aynı fonksiyonla izler.
import { FBM3, SNOISE3 } from './noise.glsl';

export const stoneVert = /* glsl */ `
uniform vec2  uShape;      // süperkuadrik üsler: x = n1 (XZ yuvarlaklığı), y = n2 (Y). 2 = yuvarlak, 8 = köşeli
uniform vec3  uRadii;      // profilden (§4.17.2): etkin engineer (1.0, 0.8, 1.0); neutral (1.0, 0.86, 1.0)
uniform float uDisp;       // düşük frekanslı gürültü genliği, <= 0.045 (kapak hilesi için dışbükeylik)
uniform float uNoiseFreq;  // varsayılan 1.3
uniform float uSeed;       // varsayılan 7.0 (deterministik: posterler canlı kareyle aynı)
varying vec3 vObj;         // yer değiştirmiş object-space konum
varying vec3 vNrm;         // object-space normal
// OCTAVES materyal "defines" ile gelir: 2 (high) | 1 (medium, low)

${SNOISE3}

${FBM3}

vec3 shapeAt(vec3 d) {
  float xz = pow(pow(abs(d.x), uShape.x) + pow(abs(d.z), uShape.x), uShape.y / uShape.x);
  float F  = xz + pow(abs(d.y), uShape.y);
  vec3  p  = d * pow(F, -1.0 / uShape.y) * uRadii;              // d yönündeki süperkuadrik noktası
  return p + normalize(p) * fbm(p * uNoiseFreq + uSeed) * uDisp;
}

void main() {
  vec3 d  = normalize(position);
  vec3 t1 = normalize(abs(d.y) > 0.99 ? cross(d, vec3(1.0, 0.0, 0.0)) : cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(d, t1);
  vec3 p0 = shapeAt(d);
  vec3 p1 = shapeAt(normalize(d + t1 * 0.004));
  vec3 p2 = shapeAt(normalize(d + t2 * 0.004));
  vec3 n  = normalize(cross(p1 - p0, p2 - p0));
  vObj = p0;
  vNrm = dot(n, p0) < 0.0 ? -n : n;                                // normal daima dışa baksın
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p0, 1.0);
}
`;
