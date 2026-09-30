// src/components/mdx/MdxBody.tsx — derlenmiş MDX gövdesi + düz Markdown tipografisi (§6.2, §6.6, §7.7.2).
// MDXContent `react-server` koşuluyla sunucuda çizilir; istemciye MDX JS'i gitmez (§7.3.4 kural 8).
// Başlık ve paragraf stilleri bileşen haritasına değil (başka anahtar YASAK) bu sarmalayıcıya aittir.
import { MDXContent } from '@content-collections/mdx/react';
import { createMdxComponents, type MdxContext } from './index';

const PROSE = [
  'max-w-text',
  '[&_h2]:mt-block [&_h2]:type-h2 [&_h2:first-child]:mt-0',
  '[&_h3]:mt-stack [&_h3]:type-h3',
  '[&_p]:mt-4 [&_p]:type-body',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:type-body [&_strong]:font-strong',
  '[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-ink-muted [&_code]:[overflow-wrap:anywhere]',
].join(' ');

export function MdxBody({ code, ctx }: { code: string; ctx: MdxContext }) {
  return (
    <div className={PROSE}>
      <MDXContent code={code} components={createMdxComponents(ctx)} />
    </div>
  );
}
