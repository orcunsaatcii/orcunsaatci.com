// src/components/ui/Tag.tsx — statik etiket ve filtre anahtarı (§6.6.3).
// static: server uyumlu, etkileşimsiz. filter: <button aria-pressed>; olay işleyicisi aldığı için yalnız istemci
// bileşenlerinin içinde kullanılır (ProjectFilter, M3).
import type { ReactNode } from 'react';

interface StaticTagProps {
  variant?: 'static';
  /** raised zemin üstünde ink-subtle YASAK (§6.3.4) → ink-muted */
  onRaised?: boolean;
  children: ReactNode;
}

interface FilterTagProps {
  variant: 'filter';
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function Tag(props: StaticTagProps | FilterTagProps) {
  if (props.variant === 'filter') {
    const { pressed, onClick, children } = props;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className={[
          'inline-flex min-h-11 items-center rounded-pill border px-4 type-ui transition-colors duration-(--dur-fast) ease-standard',
          // forced-colors: dolgu düşer ve basılı çip ötekilerden ayırt edilemiyordu (axe color-contrast) →
          // ThemeToggle'daki gibi sistem vurgu çifti (§10.5.3)
          pressed
            ? 'border-ink bg-ink text-canvas forced-colors:border-[Highlight] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none'
            : 'border-line-strong text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        {children}
      </button>
    );
  }
  return (
    <span
      className={[
        'inline-flex items-center rounded-pill border border-line px-2.5 py-1 type-meta',
        props.onRaised ? 'text-ink-muted' : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {props.children}
    </span>
  );
}
