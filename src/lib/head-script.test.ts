// src/lib/head-script.test.ts — §8.4.2 davranış tablosu (D-38, D-39); jsdom'da `new Function(headScript)()`
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HYDRATED_ATTR,
  HYDRATION_GRACE_MS,
  PREF_EVENTS,
  STORAGE_KEYS,
  headScript,
} from './head-script';

type Listener = (e: { matches: boolean }) => void;
interface FakeMql {
  matches: boolean;
  listeners: Listener[];
  addEventListener: (type: string, fn: Listener) => void;
}

const mql = (matches: boolean): FakeMql => {
  const m: FakeMql = {
    matches,
    listeners: [],
    addEventListener: (_type, fn) => m.listeners.push(fn),
  };
  return m;
};

let media: Record<string, FakeMql>;
const root = () => document.documentElement;
const run = () => new Function(headScript)();

/** storage: anahtar → değer; 'throw' → her erişim hata fırlatır */
function setup(
  storage: Record<string, string> | 'throw',
  osDark: boolean | null,
  osReduce: boolean | null,
) {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => {
    if (storage === 'throw') throw new Error('SecurityError');
    return storage[k] ?? null;
  });
  if (osDark === null || osReduce === null) {
    vi.stubGlobal('matchMedia', undefined);
    return;
  }
  media = {
    '(prefers-color-scheme: dark)': mql(osDark),
    '(prefers-reduced-motion: reduce)': mql(osReduce),
  };
  vi.stubGlobal('matchMedia', (q: string) => media[q]);
}

const attrs = () => [
  root().getAttribute('data-theme-pref'),
  root().getAttribute('data-theme'),
  root().getAttribute('data-motion'),
];

beforeEach(() => {
  const el = root();
  for (const a of ['data-theme-pref', 'data-theme', 'data-motion', HYDRATED_ATTR])
    el.removeAttribute(a);
  el.className = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('§8.4.2 davranış tablosu', () => {
  it.each([
    ['kayıt yok, OS koyu', {}, true, false, ['system', 'dark', 'full']],
    [
      'os-theme=light, OS koyu + azaltılmış',
      { [STORAGE_KEYS.theme]: 'light' },
      true,
      true,
      ['light', 'light', 'reduce'],
    ],
    [
      'os-theme=dark, os-motion=full kullanıcı OS’u ezer',
      { [STORAGE_KEYS.theme]: 'dark', [STORAGE_KEYS.motion]: 'full' },
      false,
      true,
      ['dark', 'dark', 'full'],
    ],
    [
      'geçersiz tema, os-motion=reduce',
      { [STORAGE_KEYS.theme]: 'xyz', [STORAGE_KEYS.motion]: 'reduce' },
      false,
      false,
      ['system', 'light', 'reduce'],
    ],
  ] as const)('%s', (_name, storage, osDark, osReduce, expected) => {
    setup({ ...storage }, osDark, osReduce);
    run();
    expect(attrs()).toEqual(expected);
    expect(root().classList.contains('js')).toBe(true);
  });

  it('localStorage hata fırlatınca varsayılanlar uygulanır, betik hata fırlatmaz', () => {
    setup('throw', true, false);
    expect(run).not.toThrow();
    expect(attrs()).toEqual(['system', 'dark', 'full']);
  });

  it('matchMedia yokken sistem/açık/tam hareket; betik hata fırlatmaz', () => {
    setup({}, null, null);
    expect(run).not.toThrow();
    expect(attrs()).toEqual(['system', 'light', 'full']);
  });
});

describe('OS tercih değişimleri', () => {
  it('system tercihinde OS teması izlenir ve os-theme-change yayınlanır', () => {
    setup({}, false, false);
    run();
    const onTheme = vi.fn();
    window.addEventListener(PREF_EVENTS.theme, onTheme);
    media['(prefers-color-scheme: dark)']!.listeners.forEach((f) => f({ matches: true }));
    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(onTheme).toHaveBeenCalledTimes(1);
    window.removeEventListener(PREF_EVENTS.theme, onTheme);
  });

  it('elle seçilmiş temada OS değişimi yok sayılır', () => {
    setup({ [STORAGE_KEYS.theme]: 'light' }, false, false);
    run();
    media['(prefers-color-scheme: dark)']!.listeners.forEach((f) => f({ matches: true }));
    expect(root().getAttribute('data-theme')).toBe('light');
  });

  it('os-motion kaydı yokken OS hareket tercihi izlenir; kayıt varsa yok sayılır', () => {
    setup({}, false, false);
    run();
    const onMotion = vi.fn();
    window.addEventListener(PREF_EVENTS.motion, onMotion);
    media['(prefers-reduced-motion: reduce)']!.listeners.forEach((f) => f({ matches: true }));
    expect(root().getAttribute('data-motion')).toBe('reduce');
    expect(onMotion).toHaveBeenCalledTimes(1);
    window.removeEventListener(PREF_EVENTS.motion, onMotion);

    setup({ [STORAGE_KEYS.motion]: 'full' }, false, false);
    run();
    media['(prefers-reduced-motion: reduce)']!.listeners.forEach((f) => f({ matches: true }));
    expect(root().getAttribute('data-motion')).toBe('full');
  });
});

describe('JS sınıfı yedeği (§8.4.1, §4.16.2)', () => {
  it('load + 4 s sonra data-hydrated yoksa js sınıfı kalkar', () => {
    vi.useFakeTimers();
    setup({}, false, false);
    run();
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(HYDRATION_GRACE_MS - 1);
    expect(root().classList.contains('js')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(root().classList.contains('js')).toBe(false);
  });

  it('hidrasyon işareti varsa js sınıfı kalır', () => {
    vi.useFakeTimers();
    setup({}, false, false);
    run();
    root().setAttribute(HYDRATED_ATTR, '');
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(HYDRATION_GRACE_MS);
    expect(root().classList.contains('js')).toBe(true);
  });
});

it('betik dizesi ≤ 1.5 KB (§8.9)', () => {
  expect(new TextEncoder().encode(headScript).length).toBeLessThanOrEqual(1536);
});
