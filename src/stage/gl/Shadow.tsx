// src/stage/gl/Shadow.tsx — draw 3: shadowQuad, renderOrder −1 (§5.2, §5.4.5).
// Dönen stone grubunun KARDEŞİDİR: yalnız ölçeği ve konumu paylaşır, rotX'i almaz; eğimde "masadaki" yerinde kalır.
import type { BufferGeometry, ShaderMaterial } from 'three';

export function Shadow({
  geometry,
  material,
  radii,
}: {
  geometry: BufferGeometry;
  material: ShaderMaterial;
  radii: readonly [number, number, number];
}) {
  const s = 2.4 * radii[0];
  return (
    <mesh
      name="shadowQuad"
      geometry={geometry}
      material={material}
      renderOrder={-1}
      frustumCulled={false}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -(radii[1] + 0.02), 0]}
      scale={[s, s, 1]}
    />
  );
}
