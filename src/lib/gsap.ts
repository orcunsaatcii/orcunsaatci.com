// src/lib/gsap.ts — motion chunk giriş noktası (§5.13.1).
// YALNIZCA dinamik import edilir: import('@/lib/gsap'). Statik import YASAK (D-33, ESLint SB3).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true }); // dokunmatik cihazlarda zaten varsayılan (3.15 kaynağı)
gsap.defaults({ overwrite: 'auto' }); // stageTarget alanlarında çakışan tween'ler birleşir

export const runtime = { gsap, ScrollTrigger, SplitText } as const;
export type MotionRuntime = typeof runtime;
