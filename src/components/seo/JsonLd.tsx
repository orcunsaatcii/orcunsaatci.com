// src/components/seo/JsonLd.tsx — Server Component
import type { Graph } from 'schema-dts';

/** '<' → \u003c: </script> kaçışını engeller (Next JSON-LD rehberi). */
export function serializeJsonLd(graph: Graph): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}

export function JsonLd({ graph }: { graph: Graph }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
