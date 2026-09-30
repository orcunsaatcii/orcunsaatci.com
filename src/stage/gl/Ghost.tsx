// src/stage/gl/Ghost.tsx — draw 2: ghostMesh, renderOrder 1, yalnız high (§5.2, §5.4.4).
// Stone ile aynı BufferGeometry'yi paylaşır.
import type { BufferGeometry, ShaderMaterial } from 'three';

export function Ghost({
  geometry,
  material,
}: {
  geometry: BufferGeometry;
  material: ShaderMaterial;
}) {
  return (
    <mesh
      name="ghostMesh"
      geometry={geometry}
      material={material}
      renderOrder={1}
      frustumCulled={false}
    />
  );
}
