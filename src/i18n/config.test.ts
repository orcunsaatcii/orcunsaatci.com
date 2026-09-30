// @vitest-environment node
// src/i18n/config.test.ts — route haritası bütünlüğü (§3.5.1, ZORUNLU birim testi)
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SITE_URL,
  absoluteUrl,
  alternates,
  chapterAnchors,
  dynamicRouteKeys,
  equivalentPath,
  locales,
  matchRoute,
  pathOf,
  staticRouteKeys,
  staticRoutes,
  trail,
  type PageRef,
} from './config';

const APP = join(process.cwd(), 'src/app');
const TR = join(APP, '(tr)');
const pageFile = (base: string, path: string) =>
  join(base, path === '/' ? '' : path.replace(/^\//, ''), 'page.tsx');

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pageFiles(p, out);
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

/** src/app/... /page.tsx → URL; (tr) grubu ve dinamik segmentler 'ornek' olur */
function urlOf(file: string): string {
  const parts = relative(APP, file).split(sep).slice(0, -1);
  const segs = parts
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
    .map((s) => (s.startsWith('[') ? 'ornek' : s));
  return `/${segs.join('/')}`;
}

const refs: PageRef[] = [
  ...staticRouteKeys.map((key) => ({ key })),
  ...dynamicRouteKeys.map((key) => ({ key, param: 'ornek' })),
];

describe('§3.5.1 route haritası', () => {
  it('1: her statik route için TR ve (varsa) EN page.tsx vardır', () => {
    for (const key of staticRouteKeys) {
      const def = staticRoutes[key];
      expect(existsSync(pageFile(TR, def.tr)), `${key} tr`).toBe(true);
      if (def.en !== null) expect(existsSync(pageFile(APP, def.en)), `${key} en`).toBe(true);
    }
  });

  it('2: dinamik route’ların dört sayfa dosyası vardır', () => {
    for (const f of [
      '(tr)/projeler/[slug]/page.tsx',
      'en/projects/[slug]/page.tsx',
      '(tr)/calisma-alanlari/[area]/page.tsx',
      'en/expertise/[area]/page.tsx',
    ]) {
      expect(existsSync(join(APP, f)), f).toBe(true);
    }
  });

  it('3: src/app altındaki her page.tsx bir route anahtarına karşılık gelir', () => {
    const files = pageFiles(APP);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(matchRoute(urlOf(f)), relative(APP, f)).not.toBeNull();
  });

  it('4: gidiş-dönüş ve ek durumlar', () => {
    for (const ref of refs) {
      for (const l of locales) {
        const p = pathOf(ref, l);
        if (p === null) continue;
        expect(matchRoute(p), `${ref.key}/${l}`).toEqual({ ref, locale: l });
      }
    }
    expect(matchRoute('/hakkimda/')).toEqual({ ref: { key: 'about' }, locale: 'tr' });
    expect(matchRoute('/hakkimda?x=1#y')).toEqual({ ref: { key: 'about' }, locale: 'tr' });
    for (const p of ['/yok', '/projeler/Buyuk', '/tr']) expect(matchRoute(p), p).toBeNull();
  });

  it('5: alternates()', () => {
    const both = alternates({ key: 'about' }, 'tr', ['tr', 'en']);
    expect(Object.keys(both.languages ?? {}).sort()).toEqual(['en', 'tr', 'x-default']);
    expect((both.languages as Record<string, string>)['x-default']).toBe(absoluteUrl('/hakkimda'));
    expect(alternates({ key: 'about' }, 'tr', ['tr'])).toEqual({
      canonical: absoluteUrl('/hakkimda'),
    });
    expect(() => alternates({ key: 'about' }, 'en', ['tr'])).toThrow();
    expect(() => alternates({ key: 'lab' }, 'en', ['tr', 'en'])).toThrow();
  });

  it('6: equivalentPath()', () => {
    expect(equivalentPath('/projeler/a', 'en', new Set())).toEqual({ href: '/en', exact: false });
    expect(equivalentPath('/projeler/a', 'en', new Set(['/en/projects/a']))).toEqual({
      href: '/en/projects/a',
      exact: true,
    });
    expect(equivalentPath('/en/about', 'tr', new Set()).href).toBe('/hakkimda');
    expect(equivalentPath('/yok', 'tr', new Set())).toEqual({ href: '/', exact: false });
  });

  it('7: statik yollar ASCII kebab-case', () => {
    for (const key of staticRouteKeys) {
      for (const l of locales) {
        const p = staticRoutes[key][l];
        if (p !== null) expect(p, `${key}/${l}`).toMatch(/^\/[a-z0-9/-]*$/);
      }
    }
  });

  it('8: SITE_URL sonda / taşımaz; absoluteUrl("/") kök URL’dir', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
    expect(absoluteUrl('/')).toBe(`${SITE_URL}/`);
    expect(() => absoluteUrl('hakkimda')).toThrow();
  });

  it('9: bölüm çapaları dil başına benzersiz ve küçük harf', () => {
    for (const l of locales) {
      const values = Object.values(chapterAnchors).map((a) => a[l]);
      expect(new Set(values).size).toBe(values.length);
      for (const v of values) expect(v).toMatch(/^[a-z]+$/);
    }
  });

  it('10: trail(project) → home › projects › project', () => {
    expect(trail({ key: 'project', param: 'x' }).map((r) => r.key)).toEqual([
      'home',
      'projects',
      'project',
    ]);
    expect(trail({ key: 'home' }).map((r) => r.key)).toEqual(['home']);
  });
});
