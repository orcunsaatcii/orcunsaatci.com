# orcunsaatci.com

Orçun Saatçi'nin kişisel web sitesi. Next.js 16 (App Router), React Three Fiber, GSAP + Lenis; Vercel üzerinde tamamen statik.

Şartname ve tek doğruluk kaynağı: [`product.md`](product.md).

## Kurulum

Node 24 gerekir (en az 24.15; `.nvmrc`). Adımlar için `product.md` §2.2'ye bakın.

```bash
npm ci
npm run dev        # yerel geliştirme
npm run check      # lint → typecheck → test → build → budgets
npm run e2e        # önce npm run build
```

## İçerik düzenleme

İçerik `content/` altındaki YAML ve MDX dosyalarındadır. Düzenleme akışı `product.md` §7.10'dadır.
