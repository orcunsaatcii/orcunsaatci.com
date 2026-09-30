// src/components/mdx/Callout.tsx — <aside role="note"> + görünür başlık; aksan rengi YASAK (§6.3.4, §6.6.6).
import type { ReactNode } from 'react';

export interface CalloutProps {
  title?: string; // yoksa "Not" / "Note" (callout.note)
  children: ReactNode;
}

export function Callout({
  title,
  children,
  fallbackTitle,
}: CalloutProps & { fallbackTitle: string }) {
  return (
    <aside
      role="note"
      className="my-block type-body rounded-md border-l-2 border-line-strong bg-surface p-6 [&>p:last-child]:mb-0"
    >
      <p className="mb-2 font-strong">{title ?? fallbackTitle}</p>
      {children}
    </aside>
  );
}
