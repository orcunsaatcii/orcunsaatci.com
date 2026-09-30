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

## Sahne posterleri

`public/stage/` altındaki 36 poster yerelde, `/lab/stage` laboratuvarından üretilir (`product.md` §5.16). Profil, palet, shader, K0/K1/K5 değerleri, kariyer başlangıç yılı veya alan sayısı değişince yeniden üretilip commit edilir.

```bash
NEXT_PUBLIC_ENABLE_LAB=1 npm run build && NEXT_PUBLIC_ENABLE_LAB=1 npm start   # ayrı terminal
npm run posters            # 36 poster → public/stage/
npm run posters -- --qa    # 13 anahtar × 2 tema QA ızgarası → .lab-out/
npm run posters -- --check # varlık + bütçe denetimi
```

## İçerik düzenleme

İçerik `content/` altındaki YAML ve MDX dosyalarındadır. Düzenleme akışı `product.md` §7.10'dadır.
