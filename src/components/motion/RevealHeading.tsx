// src/components/motion/RevealHeading.tsx — maskeli satır reveal'ı işaretlemesi (§5.14.1). Sunucu uyumlu.
// Yalnız öznitelik üretir; davranış MotionRoot'taki tek motordadır. H1'de YASAK (D-34). ≤ 12 kelime; daha uzun
// başlık blok reveal'ı alır (§4.5.4 kural 2).
import type { ReactNode } from 'react';

const MAX_WORDS = 12;

interface RevealHeadingProps {
  as?: 'h2' | 'h3';
  id?: string;
  className?: string;
  lang?: string;
  /** düz metin (Txt dahil); SplitText satırları DOM'dan böler ve revert() ile özgün DOM'u geri getirir */
  children: ReactNode;
  /** kelime sayısı denetimi için düz metin (children düz dize değilse verilir) */
  text?: string;
}

export function RevealHeading({
  as: Tag = 'h2',
  id,
  className,
  lang,
  children,
  text,
}: RevealHeadingProps) {
  const plain = text ?? (typeof children === 'string' ? children : '');
  const words = plain.trim().split(/\s+/).filter(Boolean).length;
  return (
    <Tag
      id={id}
      className={className}
      lang={lang}
      data-reveal={words > MAX_WORDS ? 'block' : 'lines'}
    >
      {children}
    </Tag>
  );
}
