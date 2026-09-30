// src/stage/gl/Stone.tsx — draw 1: stoneMesh, renderOrder 0 (§5.2). Şekil vertex shader'da kurulduğu için
// SphereGeometry'nin sınır küresi gerçek şekli temsil etmez: frustumCulled={false} ZORUNLU.
import type { BufferGeometry, ShaderMaterial } from 'three';

export function Stone({
  geometry,
  material,
}: {
  geometry: BufferGeometry;
  material: ShaderMaterial;
}) {
  return (
    <mesh
      name="stoneMesh"
      geometry={geometry}
      material={material}
      renderOrder={0}
      frustumCulled={false}
    />
  );
}
