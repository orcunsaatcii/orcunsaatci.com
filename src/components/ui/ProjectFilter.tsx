'use client';
// src/components/ui/ProjectFilter.tsx — /projeler alan filtresi (§7.8.2). Sunucuda "Tümü" seçili çizilir; kapsayıcı
// `hidden js:flex` olduğu için JS'siz görünümde çip yoktur, liste tamdır. ?alan= mount'ta location'dan okunur.
// SPEC-SAPMA §7.8.2: useSearchParams + <Suspense fallback={null}> statik sayfada filtreyi istemciye erteliyor, çipler
// hidrasyonda gelip listeyi aşağı itiyordu (LHCI CLS 0.093). Seçimde eşleşmeyen li[data-project] öğeleri `hidden` olur;
// URL replaceState ile ?alan=<id> (Tümü → parametre yok). Bilinmeyen değer "Tümü" sayılır.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Locale } from '@/i18n/config';
import { fill, plural, type PluralForms } from '@/i18n/text';
import { setPlanFilter } from '@/stage/fx';
import { Tag } from './Tag';

interface FilterArea {
  id: string;
  title: string;
  lang?: string; // EN sayfada TR yedeği ise 'tr'
  count: number;
  /** alan indeksi; filtre KOD panelini `ls projects/ --area=<id>` programına geçirir (§5.9.10) */
  sector: number | null;
}

interface ProjectFilterProps {
  locale: Locale;
  areas: FilterArea[]; // bu dilde en az 1 projesi olan alanlar, order sırasıyla
  total: number;
  labels: { group: string; all: string; count: PluralForms };
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
};
const readAlan = () => new URLSearchParams(window.location.search).get('alan');
const serverAlan = () => null; // SSR ve hidrasyon "Tümü" ile eşleşir; istemci anlık görüntüsü sonra uygulanır

export function ProjectFilter({ locale, areas, total, labels }: ProjectFilterProps) {
  // Paylaşılan bağlantı: ?alan=<id> yalnız istemcide okunur (D-06); bilinmeyen değer yok sayılır
  const requested = useSyncExternalStore(subscribe, readAlan, serverAlan);
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const fromUrl = requested && areas.some((a) => a.id === requested) ? requested : null;
  const active = choice === undefined ? fromUrl : choice;

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-project]').forEach((li) => {
      li.hidden = active !== null && !(li.dataset.areas ?? '').split(' ').includes(active);
    });
    const url = new URL(window.location.href);
    if (active) url.searchParams.set('alan', active);
    else url.searchParams.delete('alan');
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    setPlanFilter(active ? (areas.find((a) => a.id === active)?.sector ?? null) : null);
  }, [active, areas]);
  useEffect(() => () => setPlanFilter(null), []);

  const count = active ? (areas.find((a) => a.id === active)?.count ?? total) : total;
  return (
    <div className="hidden flex-col gap-4 js:flex">
      <div role="group" aria-label={labels.group} className="flex flex-wrap gap-2">
        <Tag variant="filter" pressed={active === null} onClick={() => setChoice(null)}>
          {fill('{label} ({count})', { label: labels.all, count: total })}
        </Tag>
        {areas.map((a) => (
          <Tag
            key={a.id}
            variant="filter"
            pressed={active === a.id}
            onClick={() => setChoice(a.id)}
          >
            <span lang={a.lang}>{a.title}</span> ({a.count})
          </Tag>
        ))}
      </div>
      <p role="status" className="type-meta">
        {plural(locale, count, labels.count)}
      </p>
    </div>
  );
}
