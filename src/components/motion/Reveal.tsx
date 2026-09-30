// src/components/motion/Reveal.tsx — blok / klip reveal işaretlemesi (§5.14.1). Sunucu uyumlu; JS maliyeti yok.
// block: 16 px yukarı + opaklık, 500 ms; clip: görsel clip-path inset(8%) → inset(0) + iç görsel scale 1.08 → 1.
// Gövde metni asla bölünmez (D-46). Gizli ön durum yalnız html[data-motion="full"].motion-ready altında (§5.14.2).
import type { HTMLAttributes } from 'react';

type RevealTag = 'div' | 'section' | 'li' | 'figure' | 'p' | 'ul' | 'dl' | 'ol';

export function Reveal({
  kind = 'block',
  as: Tag = 'div',
  ...rest
}: { kind?: 'block' | 'clip'; as?: RevealTag } & HTMLAttributes<HTMLElement>) {
  return <Tag data-reveal={kind} {...rest} />;
}
