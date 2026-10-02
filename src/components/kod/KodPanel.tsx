// src/components/kod/KodPanel.tsx — KOD statik paneli (§4 KOD). Server. Programın son karesini HTML ızgarası olarak
// çizer: JS'siz, azaltılmış harekette, statik kademede ve sahne açılana dek görünür; canlı WebGL paneli hazır olunca
// CSS ile söner (posterlerin yerini alır). Dekoratiftir (aria-hidden): asıl içerik sayfa metnindedir.
import type { CSSProperties } from 'react';
import { themeColors, toCss } from '@/design/tokens';
import { getExperienceProfile } from '@/experience/profile';
import { getSite } from '@/lib/content';
import { finalScreen, programKey, type NotFoundLinks } from '@/lib/kod/programs';
import { screenRuns } from '@/lib/kod/screen';
import type { KodData, KodProgram } from '@/lib/kod/types';
import './kod-panel.css';

interface KodPanelProps {
  data: KodData;
  program: KodProgram;
  extra?: NotFoundLinks;
  className?: string;
  /** Adım karesi (areas): aynı çapada adım başına bir panel; yalnız etkin olan görünür (§4.16.3) */
  step?: number;
  active?: boolean;
}

/**
 * Gece paneli (journey, §5.20.6): her temada koyu rol renkleri. Satır içi değişkenle verilir: derleyici light-dark()'ı
 * :root'ta çözülen değişkenlerle taklit ettiğinden öğe düzeyindeki color-scheme rol renklerini değiştiremez.
 */
function nightVars(): CSSProperties {
  const c = themeColors(getExperienceProfile(getSite().persona).palette, 'dark');
  const muted = toCss(c.inkMuted);
  return {
    '--k0': toCss(c.ink),
    '--k1': muted,
    '--k2': toCss(c.inkSubtle),
    '--k3': toCss(c.accent),
    '--k4': toCss(c.brass),
    '--k5': toCss(c.line),
    '--k6': toCss(c.surface),
    '--k7': `color-mix(in srgb, ${muted} 50%, ${toCss(c.accent)})`,
  } as CSSProperties;
}

export function KodPanel({ data, program, extra, className, step, active }: KodPanelProps) {
  const rows = screenRuns(finalScreen(data, program, extra));
  const night = program.kind === 'journey';
  return (
    <div
      className={['kod-panel', className].filter(Boolean).join(' ')}
      data-kod-program={programKey(program)}
      data-kod={JSON.stringify(program)}
      data-kod-step={step}
      data-active={active ? '' : undefined}
      data-night={night ? '' : undefined}
      aria-hidden="true"
      style={night ? nightVars() : undefined}
    >
      <pre className="kod-pre" translate="no">
        {rows.map((row, y) => (
          <span key={y} className="kod-row">
            {row.map((r, k) => {
              const style: Record<string, string | number> = {};
              if (r.alpha > 0 && r.alpha < 1) style['--a'] = r.alpha;
              if (r.bgAlpha > 0) style['--ba'] = r.bgAlpha;
              if (r.drawn) style['--n'] = [...r.text].length;
              const cls = [
                `k${r.role}`,
                r.bgAlpha > 0 ? `kb${r.bgRole}` : '',
                r.drawn ? 'kd' : '',
                r.symbol ? 'ks' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <span key={k} className={cls} style={style as CSSProperties}>
                  {r.text}
                </span>
              );
            })}
          </span>
        ))}
      </pre>
    </div>
  );
}
