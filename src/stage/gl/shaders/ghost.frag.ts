// src/stage/gl/shaders/ghost.frag.ts — kesilip atılan yarının silüeti, yalnız high (§5.4.4).
// Teknik çizimdeki "gizli çizgi" gibi ≈ %10 alfa; aynı vertex shader (stone.vert) kullanılır.

export const ghostFrag = /* glsl */ `
uniform vec4  uPlane;
uniform vec3  uCamObj;
uniform vec3  uGhostColor;
uniform float uGhostAlpha;   // 0..0.10 (track)
uniform float uTone;
varying vec3 vObj;
varying vec3 vNrm;
void main() {
  vec3  N = normalize(vNrm);
  vec3  V = normalize(uCamObj - vObj);
  float alpha = pow(1.0 - abs(dot(N, V)), 2.0) * uGhostAlpha * uTone;
  if (dot(vObj, uPlane.xyz) - uPlane.w <= 0.0) discard;         // yalnızca kaldırılmış yarı
  gl_FragColor = vec4(uGhostColor, alpha);
  #include <colorspace_fragment>
}
`;
