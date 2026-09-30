// src/stage/ScenePoster.tsx — sahne çapası ve statik poster (§5.7.3, §5.16.4). Sunucu uyumlu; three-free.
// Posterler optimizer'dan geçmez (D-31): düz <picture>. Etkin olmayan tema CSS ile gizlenir.
import type { CSSProperties, ReactNode } from 'react';
import { ANCHORS, type AnchorId } from './anchors';
import './scene-poster.css';

const W = [640, 1080, 1600] as const;
const SIZES_ATTR = '(min-width: 64rem) 38vw, 94vw';

export function ScenePoster({ posterKey }: { posterKey: 'k0' | 'k1' | 'k5' }) {
  return (['light', 'dark'] as const).map((t) => (
    <picture key={t} className="stage-poster" data-theme-only={t}>
      <source
        type="image/avif"
        sizes={SIZES_ATTR}
        srcSet={W.map((w) => `/stage/${posterKey}-${t}-${w}.avif ${w}w`).join(', ')}
      />
      <img
        src={`/stage/${posterKey}-${t}-1080.webp`}
        sizes={SIZES_ATTR}
        srcSet={W.map((w) => `/stage/${posterKey}-${t}-${w}.webp ${w}w`).join(', ')}
        width={1080}
        height={1080}
        alt=""
        loading="lazy"
        fetchPriority="low"
        decoding="async"
      />
    </picture>
  ));
}

interface StageAnchorProps {
  id: AnchorId;
  poster?: 'k0' | 'k1' | 'k5';
  /** page-folio gibi preset başına değişen boyut (§5.7.3) */
  size?: number;
  /** içinde role="img" figür varsa aria-hidden yazılmaz (§10.4.4) */
  labelled?: boolean;
  className?: string;
  children?: ReactNode;
}

/** `<div data-stage-anchor …>`: dekoratif DOM kutusu; boyutu içeriğe bağlı değildir (container-type: size). */
export function StageAnchor({ id, poster, size, labelled, className, children }: StageAnchorProps) {
  const def = ANCHORS[id];
  const s = size ?? def.size;
  return (
    <div
      data-stage-anchor={id}
      data-anchor-kind={def.kind}
      data-anchor-size={s}
      data-anchor-align={def.align}
      aria-hidden={labelled ? undefined : true}
      className={['stage-anchor', className].filter(Boolean).join(' ')}
      style={{ '--anchor-size': s } as CSSProperties}
    >
      {poster ? <ScenePoster posterKey={poster} /> : null}
      {children}
    </div>
  );
}
