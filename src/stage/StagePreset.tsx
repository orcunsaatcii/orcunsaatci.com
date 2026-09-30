'use client';
// src/stage/StagePreset.tsx — sayfanın sahneyle tek konuşma yolu (§8.5.2 kural 2). DOM üretmez.
// Preset'i ve sunucuda üretilmiş veriyi store'a yazar; unmount'ta 'none'a döner (M7: route glide anlık görüntüsü).
import { useEffect } from 'react';
import { stageStore, type PresetName, type StageData } from './store';

export function StagePreset({ name, data }: { name: PresetName; data: StageData | null }) {
  useEffect(() => {
    stageStore.getState().setPreset(name, data);
    return () => stageStore.getState().setPreset('none', null);
  }, [name, data]);
  return null;
}
