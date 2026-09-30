'use client';
// src/components/ui/LocalTime.tsx — "{{ŞEHİR}} · 14:32" (§6.6.3, §3.8 kural 9).
// SSR: yalnız şehir; saat yuvası min-w-[5ch] ile ayrılır (CLS yok). İstemci: mount sonrası saat yazılır ve dakika
// sınırında güncellenir. Azaltılmış harekette donar ve " (yerel saat)" eki alır. Duraklatılmışken (PauseButton,
// stageStore.paused) güncelleme durur (WCAG 2.2.2, §10.2.3).
import { useEffect, useState } from 'react';
import { PREF_EVENTS } from '@/lib/head-script';
import { stageStore, useStage } from '@/stage/store';

interface LocalTimeProps {
  city: string;
  timeZone: string; // içerikten, varsayılan Europe/Istanbul (§7.3.2)
  intl: string; // localeMeta[locale].intl
  frozenSuffix: string; // dict.contact.localTimeSuffix
  className?: string;
}

export function LocalTime({ city, timeZone, intl, frozenSuffix, className }: LocalTimeProps) {
  const [time, setTime] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const paused = useStage((s) => s.paused);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat(intl, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const root = document.documentElement;
    let timer = 0;
    let shown = false;
    const tick = () => {
      window.clearTimeout(timer);
      // duraklatma anlık okunur: effect temizliğinden önce çalışan eski dakika zamanlayıcısı saati ilerletmez
      const halted = stageStore.getState().paused;
      if (halted && shown) return;
      const reduce = root.getAttribute('data-motion') === 'reduce';
      setTime(fmt.format(new Date()));
      setFrozen(reduce);
      shown = true;
      if (!reduce && !halted) timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };
    timer = window.setTimeout(tick, 0);
    window.addEventListener(PREF_EVENTS.motion, tick);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(PREF_EVENTS.motion, tick);
    };
  }, [intl, timeZone, paused]);

  return (
    <span
      data-live-time=""
      className={['type-meta nums-tabular', className].filter(Boolean).join(' ')}
    >
      {city} ·{' '}
      <time dateTime={time ?? undefined} className="[display:inline-block] min-w-[5ch]">
        {time}
      </time>
      {frozen ? frozenSuffix : null}
    </span>
  );
}
