'use client';
// src/components/layout/HydrationMark.tsx — hidrasyon işareti (D-39, §8.4.2). Geçici (§15.0.6): M4'te bu işi
// MotionRoot'un ilk effect'i yapar ve bu yaprak silinir. İşaret yoksa head script `js` sınıfını load + 4 s sonra
// kaldırır; js: ile açılan denetimler (Kopyala, Yazdır, filtre çipleri) kaybolur.
import { useEffect } from 'react';
import { HYDRATED_ATTR } from '@/lib/head-script';

export function HydrationMark() {
  useEffect(() => {
    document.documentElement.setAttribute(HYDRATED_ATTR, '');
  }, []);
  return null;
}
