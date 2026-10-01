'use client';
// src/stage/LabStage.tsx — /lab/stage (§5.16.2): poster hattının tek keyframe sahnesi. Yalnız lab sayfası import eder
// (StageRoot'ta değil: ilk pakete girmez, PB-1).
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ThemeName } from '@/design/tokens';
import type { Persona } from '@/experience/profile';
import { KEYFRAME_KEYS, type KeyframeKey } from './keyframes';
import type { StageData } from './store';

// ssr:false yalnızca Client Component içinde geçerlidir; chunk ilk render'da istenir.
const Scene = dynamic(() => import('./gl/Scene'), { ssr: false, loading: () => null });

export const LAB_DEFAULT_SIZE = 1600;
const LAB_MIN_SIZE = 64;
const LAB_MAX_SIZE = 4096;

export interface LabParams {
  keyframe: KeyframeKey;
  theme: ThemeName;
  size: number;
}

/** ?key → KeyframeKey (varsayılan hero), ?theme → light | dark (varsayılan koyu, §6.3.5), ?size → px (varsayılan 1600) */
export function parseLabParams(search: string): LabParams {
  const q = new URLSearchParams(search);
  const key = q.get('key');
  const keyframe = KEYFRAME_KEYS.find((k) => k === key) ?? 'hero';
  const theme: ThemeName = q.get('theme') === 'light' ? 'light' : 'dark';
  const n = Number(q.get('size'));
  const size = Number.isInteger(n) && n >= LAB_MIN_SIZE && n <= LAB_MAX_SIZE ? n : LAB_DEFAULT_SIZE;
  return { keyframe, theme, size };
}

const subscribeNever = () => () => {};

export function LabStage({ data, persona }: { data: StageData; persona: Persona }) {
  // Sorgu YALNIZ client'ta okunur (D-06): SSR ve hidrasyon null görür, ardından gerçek değer gelir.
  const search = useSyncExternalStore(
    subscribeNever,
    () => window.location.search,
    () => null,
  );
  const params = useMemo(() => (search === null ? null : parseLabParams(search)), [search]);

  useEffect(() => {
    if (!params) return;
    const root = document.documentElement;
    root.dataset.theme = params.theme;
    root.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
  }, [params]);

  if (!params) return null;
  return (
    <div id="lab-canvas" style={{ width: params.size, height: params.size }}>
      <Scene
        mode="lab"
        keyframe={params.keyframe}
        theme={params.theme}
        size={params.size}
        data={data}
        persona={persona}
      />
    </div>
  );
}
