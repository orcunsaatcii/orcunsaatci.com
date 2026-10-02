'use client';
// src/stage/StagePreset.tsx — sayfanın sahneyle tek konuşma yolu (§8.5.2 kural 2, §5.15.3). DOM üretmez.
// Preset'i ve sunucuda üretilmiş veriyi store'a yazar. Yazmadan önce eski sayfanın son karesini nav.snapshot'a alır
// (route glide'ı). cv-core yalnız ≥ 80rem'de; altında 'none' (sayfa belge önceliklidir, §4.13.2). Unmount'ta 'none'.
import { useEffect } from 'react';
import {
  currentSceneOpacity,
  live,
  nav,
  stageStore,
  type PresetName,
  type StageData,
} from './store';

export function StagePreset({ name, data }: { name: PresetName; data: StageData | null }) {
  const key = JSON.stringify([name, data]); // küçük JSON; içerikten türetilir
  useEffect(() => {
    const gate = name === 'cv-core' ? window.matchMedia('(min-width: 80rem)') : null;
    const apply = () => {
      nav.snapshot = { ...live.panel, opacity: currentSceneOpacity() }; // eski sayfanın son paneli
      stageStore.getState().setPreset(gate && !gate.matches ? 'none' : name, data);
    };
    apply();
    gate?.addEventListener('change', apply);
    return () => {
      gate?.removeEventListener('change', apply);
      stageStore.getState().setPreset('none', null);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key, name ve data'nın içeriğidir
  return null;
}
