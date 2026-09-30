'use client';
// src/components/ui/ProjectFilter.tsx — /projeler alan filtresi (§7.8.2). <Suspense fallback={null}> içinde:
// JS'siz HTML'de çip yoktur, liste tamdır. Seçimde eşleşmeyen li[data-project] öğeleri `hidden` olur;
// URL replaceState ile ?alan=<id> (Tümü → parametre yok). Bilinmeyen değer "Tümü" sayılır.
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { fill, plural, type PluralForms } from '@/i18n/text';
import { Tag } from './Tag';

interface FilterArea {
  id: string;
  title: string;
  lang?: string; // EN sayfada TR yedeği ise 'tr'
  count: number;
}

interface ProjectFilterProps {
  locale: Locale;
  areas: FilterArea[]; // bu dilde en az 1 projesi olan alanlar, order sırasıyla
  total: number;
  labels: { group: string; all: string; count: PluralForms };
}

export function ProjectFilter({ locale, areas, total, labels }: ProjectFilterProps) {
  const params = useSearchParams();
  const requested = params.get('alan');
  const [active, setActive] = useState<string | null>(
    requested && areas.some((a) => a.id === requested) ? requested : null,
  );

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-project]').forEach((li) => {
      li.hidden = active !== null && !(li.dataset.areas ?? '').split(' ').includes(active);
    });
    const url = new URL(window.location.href);
    if (active) url.searchParams.set('alan', active);
    else url.searchParams.delete('alan');
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [active]);

  const count = active ? (areas.find((a) => a.id === active)?.count ?? total) : total;
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={labels.group} className="flex flex-wrap gap-2">
        <Tag variant="filter" pressed={active === null} onClick={() => setActive(null)}>
          {fill('{label} ({count})', { label: labels.all, count: total })}
        </Tag>
        {areas.map((a) => (
          <Tag
            key={a.id}
            variant="filter"
            pressed={active === a.id}
            onClick={() => setActive(a.id)}
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
