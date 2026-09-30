'use client';
// src/components/motion/motion-pref.ts — hareket tercihi okuyucusu (§5.13.2). MotionRoot yeniden dışa aktarır;
// ayrı modül olması global-not-found gibi MotionRoot'suz ağaçların reveal motorunu paketlememesi içindir.
import { useSyncExternalStore } from 'react';
import { PREF_EVENTS } from '@/lib/head-script';

export type MotionPref = 'full' | 'reduce';

export const readMotionPref = (): MotionPref =>
  document.documentElement.dataset.motion === 'reduce' ? 'reduce' : 'full';

export const subscribeMotionPref = (cb: () => void) => {
  window.addEventListener(PREF_EVENTS.motion, cb);
  return () => window.removeEventListener(PREF_EVENTS.motion, cb);
};

/** `<html data-motion>` + `os-motion-change`; sunucu anlık görüntüsü 'reduce'. */
export function useMotionPref(): MotionPref {
  return useSyncExternalStore(subscribeMotionPref, readMotionPref, () => 'reduce');
}
