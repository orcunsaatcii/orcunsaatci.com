// src/components/mdx/Figure.tsx — next/image + figcaption (§6.6.6, §7.7.2). Boyutlar gövdenin `media` haritasından.
import Image from 'next/image';
import type { MdxMedia } from './index';

export interface FigureProps {
  src: string;
  alt: string;
  caption?: string;
  wide?: boolean;
}

export function Figure({ src, alt, caption, wide, media }: FigureProps & { media: MdxMedia }) {
  const meta = media[src];
  if (!meta)
    throw new Error(`<Figure>: "${src}" media haritasında yok (content-collections mdxMedia)`);
  return (
    <figure className={['my-block', wide ? 'lg:-mx-[8%]' : ''].filter(Boolean).join(' ')}>
      <Image
        src={src}
        alt={alt}
        width={meta.width}
        height={meta.height}
        sizes="(min-width:1024px) 66vw, 100vw"
        className="h-auto w-full rounded-md"
        style={{ backgroundColor: meta.dominant }}
      />
      {caption ? <figcaption className="mt-3 max-w-[40ch] type-meta">{caption}</figcaption> : null}
    </figure>
  );
}
