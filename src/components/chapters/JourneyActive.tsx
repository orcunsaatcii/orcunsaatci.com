'use client';
// src/components/chapters/JourneyActive.tsx — journey:active olayında etkin girdinin <time> etiketleri vurgu rengi
// alır (aynı anda tek yıl); KOD git log paneli aynı olayı dinler (§4 KOD). Olaylar yalnız
// director çalışırken (tam hareket) gelir; azaltılmış harekette vurgu yoktur (§4.10.8). DOM üretmez.
import { useEffect } from 'react';
import { useMotionRuntime } from '@/components/motion/MotionRoot';
import { onStageEvent } from '@/stage/events';

export function JourneyActive({ sectionId }: { sectionId: string }) {
  const rt = useMotionRuntime();

  useEffect(() => {
    const section = document.getElementById(sectionId);
    if (!rt || !section) return;
    const entries = [...section.querySelectorAll<HTMLElement>('[data-journey-entry]')];
    const set = (k: number) => {
      entries.forEach((el, i) => el.toggleAttribute('data-active', i === k));
    };
    const off = onStageEvent('journey:active', (e) => set(e.index));
    return () => {
      off();
      set(-1);
    };
  }, [rt, sectionId]);

  return null;
}
