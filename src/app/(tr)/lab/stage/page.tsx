// src/app/(tr)/lab/stage/page.tsx — poster laboratuvarı (D-40, §5.16.2). Hiçbir yerden bağlanmaz; robots /lab'ı engeller.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSite, getStageData } from '@/lib/content';
import { LabStage } from '@/stage/LabStage';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NEXT_PUBLIC_ENABLE_LAB !== '1') notFound(); // build anında: Vercel'de 404
  // ?key, ?theme, ?size YALNIZ client'ta okunur (D-06); persona içerikten (§4.17)
  return <LabStage data={getStageData('home')} persona={getSite().persona} />;
}
