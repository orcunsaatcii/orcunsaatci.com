// src/components/mdx/Gallery.tsx — ≥ 64rem'de 2 ya da 3 sütun; lightbox yok (§6.6.6, §7.7.2).
import type { ReactNode } from 'react';

export interface GalleryProps {
  columns?: 2 | 3;
  children: ReactNode; // yalnızca <Figure> çocukları
}

export function Gallery({ columns = 2, children }: GalleryProps) {
  return (
    <div
      className={[
        'my-block grid grid-cols-1 gap-gutter [&>figure]:my-0',
        columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
