// src/stage/StageAnchor.tsx — sahne çapası (§5.7.3, §4.5.6). Sunucu uyumlu; three-free. Dekoratif DOM kutusudur
// (aria-hidden); içinde çapanın KOD statik paneli durur (§4.16.3). Canlı panel aynı kutuya yerleşir (§5.20.4).
import type { CSSProperties, ReactNode } from 'react';
import { ANCHORS, type AnchorId } from './anchors';
import './stage-anchor.css';

interface StageAnchorProps {
  id: AnchorId;
  /** page-folio gibi preset başına değişen boyut (§5.7.3; KOD paneli kullanmaz, yönetmen ölçümü için) */
  size?: number;
  className?: string;
  children?: ReactNode;
}

/** `<div data-stage-anchor …>`: dekoratif DOM kutusu; boyutu içeriğe bağlı değildir (container-type: size). */
export function StageAnchor({ id, size, className, children }: StageAnchorProps) {
  const def = ANCHORS[id];
  const s = size ?? def.size;
  return (
    <div
      data-stage-anchor={id}
      data-anchor-kind={def.kind}
      data-anchor-size={s}
      data-anchor-align={def.align}
      aria-hidden
      className={['stage-anchor', className].filter(Boolean).join(' ')}
      style={{ '--anchor-size': s } as CSSProperties}
    >
      {children}
    </div>
  );
}
