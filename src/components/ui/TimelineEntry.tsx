// src/components/ui/TimelineEntry.tsx — CV / journey girdisi (§6.6.3, §4.10.2, §7.6.2). Server.
// Genel görünüm yıl, ayrıntılı görünüm ay hassasiyetinde. Süren kayıt "Halen" + 6 px aksan noktası.
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { formatPartialDate } from '@/i18n/format';

interface TimelineEntryProps {
  locale: Locale;
  start: string;
  end?: string;
  precision: 'year' | 'full';
  presentLabel: string;
  title: ReactNode; // <h3> içeriği (rol)
  subtitle?: ReactNode; // kurum · şehir
  children?: ReactNode; // sonuçlar
  as?: 'li' | 'article';
  className?: string;
  /** ana sayfa journey: data-journey-entry (aktivasyon çizgisi, §5.9.5) */
  entryIndex?: number;
  /** /cv: data-cv-entry (cv-core bant event'i, §4.13.2) */
  cvEntry?: boolean;
  /** blok reveal'ı (§4.10.2) */
  reveal?: boolean;
}

export function TimelineEntry({
  locale,
  start,
  end,
  precision,
  presentLabel,
  title,
  subtitle,
  children,
  as: Tag = 'li',
  className,
  entryIndex,
  cvEntry,
  reveal,
}: TimelineEntryProps) {
  const label = (d: string) =>
    precision === 'year' ? d.slice(0, 4) : formatPartialDate(d, locale);
  return (
    <Tag
      data-journey-entry={entryIndex}
      data-cv-entry={cvEntry ? '' : undefined}
      data-reveal={reveal ? 'block' : undefined}
      className={[
        'grid gap-x-gutter gap-y-2 lg:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="type-meta nums-tabular lg:text-right">
        <time dateTime={start}>{label(start)}</time>
        {' – '}
        {end ? (
          <time dateTime={end}>{label(end)}</time>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {presentLabel}
            <span
              aria-hidden="true"
              className="[display:inline-block] size-1.5 rounded-pill bg-accent"
            />
          </span>
        )}
      </p>
      <div>
        <h3 className="type-h4">{title}</h3>
        {subtitle ? <p className="mt-1 type-ui text-ink-muted">{subtitle}</p> : null}
        {children ? <div className="mt-3 type-body">{children}</div> : null}
      </div>
    </Tag>
  );
}
