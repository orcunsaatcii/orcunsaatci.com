// src/components/ui/Txt.tsx — t() sonucunu çizer; EN sayfada TR yedeği <span lang="tr"> içinde (§7.4.4 kural 1, §3.8).
import type { Localized } from '@/lib/content';

export function Txt({ v }: { v: Localized }) {
  return v.fallback ? <span lang={v.lang}>{v.text}</span> : <>{v.text}</>;
}
