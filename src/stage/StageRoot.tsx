'use client';
// src/stage/StageRoot.tsx — M1'de yalnız LabStage (§5.16.2). Asıl StageRoot (#scene-layer, lazy boot, tier'lar,
// hata sınırı) M5'tedir; o da /lab/ altında boot etmez, lab tek WebGL bağlamını kendisi kurar.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ThemeName } from '@/design/tokens';
import { KEYFRAME_KEYS, type KeyframeKey } from './keyframes';
import type { StageData } from './store';

// Stage chunk: three + R3F yalnız bu dinamik import'la gelir; ilk pakete girmez (§5.1.4, §9.4).
const Scene = dynamic(() => import('./gl/Scene'), { ssr: false });

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

export function LabStage({ data }: { data: StageData }) {
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
      />
    </div>
  );
}
