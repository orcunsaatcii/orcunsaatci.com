// src/components/mdx/allowed.ts (saf): index.ts ve check-content (C12) aynı listeyi kullanır (§7.7.2).
export const MDX_COMPONENTS = ['Figure', 'Gallery', 'Callout', 'Quote'] as const;
export type MdxComponentName = (typeof MDX_COMPONENTS)[number];
