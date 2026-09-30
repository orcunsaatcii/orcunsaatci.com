'use client';
// src/components/chapters/DialRotor.tsx — statik kademede areas DialFigure'ün rotY track'iyle dönüşü (§5.13.5,
// §4.3 beyaz liste #4, K-VAR-4). Director'ün her güncellemesinde stageTarget.rotYScroll okunur ve SVG'ye
// --dial-rot = −rotY yazılır. Yalnız pin etkinken (liste modunda figür durağandır). DOM üretmez.
import { useEffect } from 'react';
import { dialRotation } from '@/components/figures/DialFigure';
import { useMotionRuntime } from '@/components/motion/MotionRoot';
import { onStageUpdate } from '@/stage/events';
import { stageTarget } from '@/stage/store';
import { useAreasPinned } from './AreasPin';

export function DialRotor({ sectionId }: { sectionId: string }) {
  const rt = useMotionRuntime();
  const pinned = useAreasPinned();

  useEffect(() => {
    const svg = document
      .getElementById(sectionId)
      ?.querySelector<SVGSVGElement>('.areas-dial [data-dial-figure]');
    if (!rt || !pinned || !svg) return;
    let last = Number.NaN;
    const off = onStageUpdate(() => {
      const r = stageTarget.rotYScroll;
      if (Math.abs(r - last) < 0.01) return;
      last = r;
      svg.style.setProperty('--dial-rot', dialRotation(r));
    });
    return () => {
      off();
      svg.style.removeProperty('--dial-rot');
    };
  }, [rt, pinned, sectionId]);

  return null;
}
