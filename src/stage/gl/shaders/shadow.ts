// src/stage/gl/shaders/shadow.ts — sahte temas gölgesi quad'ı (§5.4.5). Gölge haritası yoktur.

export const shadowVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const shadowFrag = /* glsl */ `
uniform vec3  uShadowColor;
uniform float uShadowAlpha;  // açık 0.16 / koyu 0.45
uniform float uTone;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5);
  float alpha = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0) * uShadowAlpha * uTone;
  gl_FragColor = vec4(uShadowColor, alpha);
  #include <colorspace_fragment>
}
`;
