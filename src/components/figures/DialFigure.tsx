// src/components/figures/DialFigure.tsx — alan kadranı: plan görünüşünde N dilim (§4.8.4, §4.8.9, §4.16.3, §6.6.5).
// Sunucu uyumlu; olay aboneliği yok. Dönüş YALNIZ --dial-rot CSS değişkeniyle: statik kademede director'ü dinleyen
// istemci bileşeni <svg>'ye dialRotation(rotY) yazar (§5.13.5, §4.3 beyaz liste #4). Varsayılan −ψ(etkin) etkin dilimi
// saat 9'a koyar (§5.7.7; etkin 0 → −45deg = areas adım 0). Etkin dilim data-active, önizleme data-preview (§6.6.5).
// 'glyph': liste modunda alan başına 64 px dilim glifi (§4.8.2): aria-hidden, sabit dönüş, etiket yok.
import { polar, psiDeg, ringRadius, sectorPath } from '@/lib/section-geometry';
import {
  C,
  DISK,
  LABEL,
  LINE,
  LINE_FAINT,
  R_FIGURE,
  R_GLYPH,
  SECTOR,
  SIZE,
  cx,
  indexIn,
  r2,
  sectorCenterDeg,
  sectorSpokes,
} from './figure-style';

export interface DialFigureProps {
  n: number; // 3–6 dilim
  /** "Çalışma alanları: A, B, C, D" (§10.4.4); yalnız 'dial' */
  ariaLabel: string;
  /** eş merkezli halka sayısı (StageData.rings); varsayılan 4 */
  rings?: number;
  /** başlangıçta etkin dilim (accent 0.5); null = yok. Varsayılan 0 */
  active?: number | null;
  /** 'dial' çapayı doldurur; 'glyph' liste modunda 64 px dilim glifi */
  variant?: 'dial' | 'glyph';
  className?: string;
}

const LABEL_R = R_FIGURE + 10; // indeks etiketleri diskin hemen dışında, dilim ortasında

/** 3D rotY (derece; ψₖ ya da rotY track'i) → --dial-rot değeri. CSS'te pozitif açı saat yönündedir (§5.7.7). */
export function dialRotation(rotYDeg: number): string {
  return `${r2(-rotYDeg)}deg`;
}

export function DialFigure({
  n,
  ariaLabel,
  rings = 4,
  active = 0,
  variant = 'dial',
  className,
}: DialFigureProps) {
  const N = n >= 3 ? Math.floor(n) : 0; // < 3: dilim yok (liste modu, §5.10)
  const act = indexIn(active, N);
  const psi = psiDeg(act ?? 0, Math.max(N, 1)); // etkin (yoksa 0) dilimi saat 9'a getiren ψ
  const sectors = Array.from({ length: N }, (_, k) => k);

  if (variant === 'glyph') {
    return (
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={64}
        height={64}
        aria-hidden="true"
        focusable="false"
        data-dial-glyph=""
        className={cx('size-16 shrink-0', className)}
      >
        <circle cx={C} cy={C} r={R_GLYPH} className={DISK} />
        <g transform={`rotate(${r2(-psi)} ${C} ${C})`}>
          {act !== null ? (
            <path
              data-sector={act}
              data-active=""
              d={sectorPath(act, N, R_GLYPH, C, C)}
              className={SECTOR}
            />
          ) : null}
          {sectorSpokes(N, R_GLYPH).map((p, k) => (
            <line key={k} x1={C} y1={C} {...p} className={LINE} />
          ))}
        </g>
      </svg>
    );
  }

  const rest = dialRotation(psi);
  const ringCount = Math.max(1, Math.floor(rings));
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={ariaLabel}
      data-dial-figure=""
      className={cx('block h-auto w-full', className)}
    >
      <g
        data-dial-rotor=""
        style={{
          transform: `rotate(var(--dial-rot, ${rest}))`,
          transformOrigin: 'center',
          transformBox: 'view-box',
        }}
      >
        <circle cx={C} cy={C} r={R_FIGURE} className={DISK} />
        {sectors.map((k) => (
          <path
            key={k}
            data-sector={k}
            data-active={k === act ? '' : undefined}
            d={sectorPath(k, N, R_FIGURE, C, C)}
            className={SECTOR}
          />
        ))}
        {Array.from({ length: ringCount - 1 }, (_, i) => (
          <circle
            key={i}
            cx={C}
            cy={C}
            r={r2(ringRadius(i, ringCount, R_FIGURE))}
            className={LINE_FAINT}
          />
        ))}
        {sectorSpokes(N, R_FIGURE).map((p, k) => (
          <line key={k} x1={C} y1={C} {...p} className={LINE} />
        ))}
        {sectors.map((k) => {
          const [x, y] = polar(C, C, LABEL_R, sectorCenterDeg(k, N));
          return (
            <text
              key={k}
              data-dial-label={k}
              x={r2(x)}
              y={r2(y)}
              textAnchor="middle"
              dominantBaseline="central"
              className={LABEL}
              // rotor döndükçe etiket kendi merkezinde ters döner: hep dik okunur
              style={{
                transform: `rotate(calc(-1 * var(--dial-rot, ${rest})))`,
                transformBox: 'fill-box',
                transformOrigin: 'center',
              }}
            >
              {String(k + 1).padStart(2, '0')}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
