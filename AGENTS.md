<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proje kuralları (orcunsaatci.com)

- Şartname: `product.md`. Her oturumda önce §0'ı ve çalışılan milestone'un §15 alt bölümünü oku.
- Milestone, `npm run check` yeşil olmadan bitmez.
- ZORUNLU/YASAK kuralları ihlal edilmez; sapma commit mesajında `SPEC-SAPMA: §x.y — …` ile kaydedilir.
- `three`, `@react-three/*`, `maath` yalnız `src/stage/gl/**` altında import edilir.
- Sürümler `product.md` §2.1'de sabittir: TypeScript 7, ESLint 10, React ≥ 19.4 YASAK.
