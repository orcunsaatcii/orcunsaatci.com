'use client';
// src/stage/ScrollDirector.tsx — tek örnek; <div data-stage-scope> sayfa içeriğini sarar ve koşulsuz render edilir
// (§5.13.5, §8.5.2 kural 1). Gövde director.ts'tedir: motion runtime import'uyla aynı pencerede istenir
// (onMotionImport) ve runtime + preset + veri varken çalışır. İlk pakette yalnız bu sarmalayıcı vardır (PB-1).
import { useEffect, useRef, type ReactNode } from 'react';
import { onMotionImport, useMotionRuntime } from '@/components/motion/MotionRoot';
import { useStage } from './store';

const loadDirector = () => import('./director');

export function ScrollDirector({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const rt = useMotionRuntime();
  const preset = useStage((s) => s.preset);
  const data = useStage((s) => s.data);

  // Gövde runtime'la birlikte istenir: runtime geldiğinde hazırdır (ağ hatasında aşağıdaki import yeniden dener)
  useEffect(() => onMotionImport(() => void loadDirector().catch(() => {})), []);

  useEffect(() => {
    const root = scope.current;
    if (!rt || !root || !data || preset === 'none') return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    loadDirector().then(
      ({ runDirector }) => {
        if (!cancelled) stop = runDirector(root, rt, preset, data);
      },
      () => {}, // chunk gelmedi: koreografi yok, sayfa posterlerle statik kalır
    );
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [rt, preset, data]);

  return (
    <div ref={scope} data-stage-scope="">
      {children}
    </div>
  );
}
