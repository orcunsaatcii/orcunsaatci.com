// @vitest-environment node
// src/experience/persona.test.tsx — K-PERSONA-3 (§4.17.1, §4.18): persona değişince URL'ler, çapa id'leri ve DOM
// yapısı aynı kalır; yalnız etiketler (profil metinleri), palet (satır içi renkler) ve JSON-LD iş düğümünün alt tipi
// (§11.6.2) değişir. Sayfalar gerçek içerikle (content-collections çıktısı) sunucu bileşenleri olarak render edilir:
// build'in ürettiği sayfa gövdesiyle aynı ağaç (layout ve sahne çalışma zamanı hariç; ikisi de persona'dan yalnız
// palet, tip ve yoğunluk okur). SPEC-SAPMA §4.18 (M8): "iki persona ile build" yerine her persona için bütün
// görünümlerin sunucu render'ı; ikinci bir `next build` CI'ı dakikalarca uzatırdı.
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/i18n/config';
import { getAreaPageIds, getAreas, getProjects, getSite, isLocaleEnabled } from '@/lib/content';
import { AboutView } from '@/views/about/AboutView';
import { AreaView } from '@/views/area/AreaView';
import { ContactView } from '@/views/contact/ContactView';
import { CvView } from '@/views/cv/CvView';
import { ExpertiseView } from '@/views/expertise/ExpertiseView';
import { HomeView } from '@/views/home/HomeView';
import { NotFoundView } from '@/views/not-found/NotFoundView';
import { PrivacyView } from '@/views/privacy/PrivacyView';
import { ProjectView } from '@/views/project/ProjectView';
import { ProjectsView } from '@/views/projects/ProjectsView';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { PROFILES, type Persona } from './profile';

// istemci bileşenleri (header bağlantıları) yol okur; App Router bağlamı testte yoktur
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/',
}));
// Next'in React kanaryasındaki <ViewTransition> DOM üretmez; düz react 19.2'de yoktur → yalnız çocuklar
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  ViewTransition: ({ children }: { children: ReactNode }) => children,
}));

const site = getSite();
const original = site.persona;
afterAll(() => {
  site.persona = original;
});

const LOCALES = (['tr', 'en'] as const).filter((l) => isLocaleEnabled(l));

function views(locale: Locale): [string, ReactElement][] {
  return [
    ['header', <SiteHeader key="h" locale={locale} enPaths={[]} />],
    ['home', <HomeView key="home" locale={locale} />],
    ['about', <AboutView key="about" locale={locale} />],
    ['expertise', <ExpertiseView key="expertise" locale={locale} />],
    ['projects', <ProjectsView key="projects" locale={locale} />],
    ['cv', <CvView key="cv" locale={locale} />],
    ['contact', <ContactView key="contact" locale={locale} />],
    ['privacy', <PrivacyView key="privacy" locale={locale} />],
    ['not-found', <NotFoundView key="nf" locale={locale} />],
    ...getProjects(locale).map((p): [string, ReactElement] => [
      `project:${p.slug}`,
      <ProjectView key={p.slug} project={p} locale={locale} />,
    ]),
    ...getAreas()
      .filter((a) => getAreaPageIds(locale).includes(a.id))
      .map((a): [string, ReactElement] => [
        `area:${a.id}`,
        <AreaView key={a.id} area={a} locale={locale} />,
      ]),
    ['footer', <SiteFooter key="f" locale={locale} enPaths={[]} variant="full" />],
  ];
}

interface Render {
  /** etiket ağacı + bütün nitelikler; metin, satır içi stil ve JSON-LD gövdesi hariç */
  skeleton: string;
  texts: string[];
  hrefs: string[];
  ids: string[];
  graphs: { id: unknown; type: unknown }[][];
}

function render(persona: Persona, locale: Locale): Map<string, Render> {
  site.persona = persona;
  const out = new Map<string, Render>();
  for (const [name, el] of views(locale)) {
    const html = renderToStaticMarkup(el);
    const graphs = [
      ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map(([, json = '{}']) =>
      ((JSON.parse(json) as { '@graph'?: Record<string, unknown>[] })['@graph'] ?? []).map((n) => ({
        id: n['@id'],
        type: n['@type'],
      })),
    );
    const bare = html
      .replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/g, '$1$2')
      .replace(/ style="[^"]*"/g, '');
    out.set(name, {
      skeleton: bare.replace(/>[^<]+</g, '><'),
      texts: [...bare.matchAll(/>([^<]+)</g)].map(([, t = '']) => t),
      hrefs: [...html.matchAll(/ href="([^"]*)"/g)].map(([, h = '']) => h),
      ids: [...html.matchAll(/ (?:id|data-chapter|data-stage-anchor)="([^"]*)"/g)].map(
        ([, v = '']) => v,
      ),
      graphs,
    });
  }
  return out;
}

/** Bir persona'nın görünür metne giren profil etiketleri (React'in HTML kaçışıyla) */
function labelTexts(persona: Persona, locale: Locale): Set<string> {
  const { labels } = PROFILES[persona];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;');
  return new Set(
    [labels.areas, labels.work, labels.contactLead, ...Object.values(labels.eyebrows)].map((l) =>
      esc(l[locale]),
    ),
  );
}

describe('K-PERSONA-3 persona değişimi', () => {
  const others = (Object.keys(PROFILES) as Persona[]).filter((p) => p !== 'engineer');

  for (const locale of LOCALES) {
    const base = render('engineer', locale);

    for (const persona of others) {
      it(`${locale}: engineer → ${persona} — URL'ler, çapa id'leri ve DOM yapısı aynı; yalnız etiketler değişir`, () => {
        const next = render(persona, locale);
        expect([...next.keys()]).toEqual([...base.keys()]);
        const allowed = new Set([
          ...labelTexts('engineer', locale),
          ...labelTexts(persona, locale),
        ]);
        for (const [name, a] of base) {
          const b = next.get(name)!;
          expect(b.hrefs, `${name}: href`).toEqual(a.hrefs);
          expect(b.ids, `${name}: id / data-chapter / data-stage-anchor`).toEqual(a.ids);
          expect(b.skeleton, `${name}: DOM yapısı`).toBe(a.skeleton);
          const changed = a.texts.flatMap((t, i) =>
            t === b.texts[i] ? [] : [`${t} → ${b.texts[i] ?? ''}`],
          );
          const foreign = changed.filter((c) => {
            const [from = '', to = ''] = c.split(' → ');
            return !allowed.has(from) || !allowed.has(to);
          });
          expect(foreign, `${name}: profil etiketi dışında değişen metin`).toEqual([]);
          // JSON-LD: aynı @id kümesi; tip yalnız iş düğümünde değişebilir (researcher → ScholarlyArticle)
          expect(
            b.graphs.map((g) => g.map((n) => n.id)),
            `${name}: JSON-LD @id`,
          ).toEqual(a.graphs.map((g) => g.map((n) => n.id)));
          const retyped = b.graphs
            .flat()
            .filter((n, i) => n.type !== a.graphs.flat()[i]?.type)
            .map((n) => `${String(n.id)} ${String(n.type)}`);
          for (const r of retyped)
            expect(r, `${name}: JSON-LD alt tipi`).toMatch(/#work ScholarlyArticle$/);
        }
      });
    }
  }

  it('etiketler persona’lar arasında gerçekten farklıdır (karşılaştırma boş geçmez)', () => {
    const home = (p: Persona) => render(p, 'tr').get('home')!.texts;
    expect(home('designer')).not.toEqual(home('engineer'));
  });
});
