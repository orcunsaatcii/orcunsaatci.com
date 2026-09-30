'use client';
// src/components/layout/ThemeToggle.tsx — Sistem / Koyu / Açık (§6.3.5, §6.6.2, §10.3.4).
// <fieldset> + görsel olarak gizli <legend> + üç yerel radio; değişim anlık, React state'i değildir (§8.5.2 kural 7):
// localStorage['os-theme'], <html data-theme-pref / data-theme> yazılır ve os-theme-change yayınlanır.
// JS yoksa çalışamayacağı için gizlidir (js: varyantı).
import { useId, useSyncExternalStore } from 'react';
import { PREF_EVENTS, STORAGE_KEYS } from '@/lib/head-script';

type Pref = 'system' | 'dark' | 'light';
const PREFS: readonly Pref[] = ['system', 'dark', 'light'];

const subscribe = (cb: () => void) => {
  window.addEventListener(PREF_EVENTS.theme, cb);
  return () => window.removeEventListener(PREF_EVENTS.theme, cb);
};
const readPref = (): Pref => {
  const v = document.documentElement.getAttribute('data-theme-pref');
  return v === 'light' || v === 'dark' ? v : 'system';
};

function applyPref(pref: Pref) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.theme, pref);
  } catch {
    // depolama kapalı: tercih yalnız bu sayfada geçerli (D-38)
  }
  let dark = pref === 'dark';
  if (pref === 'system') {
    try {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      dark = false;
    }
  }
  const root = document.documentElement;
  root.setAttribute('data-theme-pref', pref);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  window.dispatchEvent(new Event(PREF_EVENTS.theme));
}

export function ThemeToggle({ labels }: { labels: Record<'label' | Pref, string> }) {
  const pref = useSyncExternalStore(subscribe, readPref, () => 'system' as const);
  const name = useId();
  return (
    <fieldset className="hidden rounded-pill border border-line-strong p-0.5 js:inline-flex">
      <legend className="sr-only">{labels.label}</legend>
      {PREFS.map((p) => (
        <label
          key={p}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-4 type-ui text-ink-muted hover:text-ink has-checked:bg-ink has-checked:text-canvas has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-focus forced-colors:has-checked:bg-[Highlight] forced-colors:has-checked:text-[HighlightText] forced-colors:has-checked:forced-color-adjust-none"
        >
          <input
            type="radio"
            name={name}
            value={p}
            checked={pref === p}
            onChange={() => applyPref(p)}
            className="sr-only"
          />
          {labels[p]}
        </label>
      ))}
    </fieldset>
  );
}
