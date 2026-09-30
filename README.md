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

## Fontlar

`src/fonts/*.woff2` ve `assets/fonts/ttf/*.ttf`, `assets/fonts/src/` altındaki kaynak TTF'lerden `npm run fonts` ile üretilip commit edilir. Python 3 + `fonttools==4.60.2` + `brotli` gerekir; başka yorumlayıcı için `PYTHON=/yol/python3 npm run fonts` (`product.md` §6.2.3).

## Görsel regresyon tabanları

`tests/e2e/__screenshots__/` yalnız CI'da, Linux'ta üretilir: GitHub Actions → `ci` → Run workflow → `update_snapshots`. Oluşan `visual-baselines` artefaktı indirilip commit edilir; macOS'ta üretilen tabanlar commit edilmez (`product.md` §13.4.2).

## İçerik düzenleme

İçerik `content/` altındaki YAML ve MDX dosyalarındadır. Düzenleme akışı `product.md` §7.10'dadır.
