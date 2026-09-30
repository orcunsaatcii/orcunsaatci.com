// src/app/(tr)/lab/stage/page.tsx — poster laboratuvarı (D-40, §5.16.2). Hiçbir yerden bağlanmaz; robots /lab'ı engeller.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { bandOf, ringGeometry } from '@/lib/section-geometry';
import { LabStage } from '@/stage/StageRoot';
import type { StageData } from '@/stage/store';

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Geçici (§15.0.6): getStageData('home') yerine M1 tohum değerleri (§15.0.3, §15.2.1 #9).
// careerStartYear 2014, derleme yılı → 2026'da 13 halka; N = 4 dilim; 4 proje, 6 kayıt. M3'te erişimciyle değiştirilir.
const SEED_CAREER_START = 2014;
const g = ringGeometry(SEED_CAREER_START, new Date().getFullYear());

const LAB_DATA: StageData = {
  rings: g.rings,
  sectors: 4,
  projects: [
    { slug: 'tohum-proje-1', area: 0, band: bandOf(g.currentYear - 1, null, g) },
    { slug: 'tohum-proje-2', area: 1, band: bandOf(g.currentYear - 4, g.currentYear - 2, g) },
    { slug: 'tohum-proje-3', area: 2, band: bandOf(g.currentYear - 7, g.currentYear - 5, g) },
    { slug: 'tohum-proje-4', area: 3, band: bandOf(g.currentYear - 10, g.currentYear - 8, g) },
  ],
  entries: [
    { band: bandOf(g.currentYear - 3, null, g) },
    { band: bandOf(g.currentYear - 5, g.currentYear - 4, g) },
    { band: bandOf(g.currentYear - 7, g.currentYear - 6, g) },
    { band: bandOf(g.currentYear - 9, g.currentYear - 8, g) },
    { band: bandOf(g.currentYear - 11, g.currentYear - 10, g) },
    { band: bandOf(SEED_CAREER_START, g.currentYear - 12, g) },
  ],
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_ENABLE_LAB !== '1') notFound(); // build anında: Vercel'de 404
  return <LabStage data={LAB_DATA} />; // ?key, ?theme, ?size YALNIZ client'ta okunur (D-06)
}
