'use client';
// src/components/motion/PauseButton.tsx — "Animasyonu durdur / başlat" (§4.6.3, §10.2.2, §4.14 #12).
// Etiket durumla değişir; aria-pressed YASAK (ARIA APG dönüş denetimi deseni). Yalnız data-motion="full" iken ve
// hidrasyondan sonra render edilir (useMotionPref sunucu anlık görüntüsü 'reduce'); mutlak konumlu, CLS yok.
// Durum stageStore.paused (kalıcı değil). M4: LocalTime/saat güncellemeleri durur; sahne etkileri M5/M7'de.
import { stageStore, useStage } from '@/stage/store';
import { useMotionPref } from './motion-pref';

export function PauseButton({
  labels,
  className,
}: {
  labels: { pause: string; play: string };
  className?: string;
}) {
  const pref = useMotionPref();
  const paused = useStage((s) => s.paused);
  if (pref !== 'full') return null;
  return (
    <button
      type="button"
      onClick={() => stageStore.getState().setPaused(!paused)}
      className={[
        'inline-flex min-h-11 min-w-11 items-center gap-2 rounded-pill bg-canvas/92 px-4 type-ui text-ink-muted hover:text-ink',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        {paused ? (
          <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
        ) : (
          <path d="M4 2.5h2.5v11H4zM9.5 2.5H12v11H9.5z" fill="currentColor" />
        )}
      </svg>
      {paused ? labels.play : labels.pause}
    </button>
  );
}
