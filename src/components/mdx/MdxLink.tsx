// src/components/mdx/MdxLink.tsx — Markdown bağlantısı (§7.7.2 `a`): "/" ile başlıyorsa next/link,
// http(s) ise ↗ ve rel="noopener noreferrer" ile aynı sekmede (TextLink external).
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { TextLink } from '@/components/ui/TextLink';

export function MdxLink({ href = '', children }: { href?: string; children?: ReactNode }) {
  return href.startsWith('/') ? (
    <TextLink href={href as Route}>{children}</TextLink>
  ) : (
    <TextLink variant="external" href={href}>
      {children}
    </TextLink>
  );
}
